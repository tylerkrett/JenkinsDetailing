"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, type Mesh, type PointLight, Vector3 } from "three";

import { lerp, unlerp } from "~/lib/motion";
import { BAY, CAR } from "~/lib/scene/bay-layout";

import type { CarFrame } from "./car";
import { Spray, type SprayFrame } from "./spray";
import { Brush, Cloth, Lance, Polisher } from "./tools";

/** What the bay knows each frame about where the scroll is. */
export type ActFrame = { act: number; dwell: number; approach: number };

type Props = { act: React.MutableRefObject<ActFrame>; car: React.MutableRefObject<CarFrame>; mobile: boolean };

const smooth = (t: number) => t * t * (3 - 2 * t);
/** The car's left flank in world x, and its nose and tail in z. */
const FLANK_X = -0.98;
const NOSE = -2.3;
const TAIL = 2.3;

/** Height of the paint surface along the centre line of the bonnet, roof and deck. */
function topAt(z: number) {
  if (z < -1.3) return lerp(0.78, 1.02, unlerp(-2.3, -1.3, z));
  if (z < 0.2) return lerp(1.02, 1.26, unlerp(-1.3, 0.2, z));
  return lerp(1.26, 1.05, unlerp(0.2, 2.3, z));
}

/** A tool in the scene: where it is, what it points at, and whether it is out. */
type ToolFrame = { position: Vector3; aim: Vector3; on: number };
function toolFrame(): ToolFrame {
  return { position: new Vector3(), aim: new Vector3(0, -1, 0), on: 0 };
}

/**
 * The tools and the effects, act by act, every position a function of the act's dwell.
 * Writes the car's process uniforms (dull, foam, haze, chassis) through the shared car
 * frame so the shaders and the tools agree on where the work has got to.
 */
export function Process({ act, car, mobile }: Props) {
  const spray = useRef<SprayFrame>({ origin: new Vector3(), target: new Vector3(), on: 0 });
  const lance = useRef<ToolFrame>(toolFrame());
  const brush = useRef<ToolFrame>(toolFrame());
  const polisher = useRef<ToolFrame>(toolFrame());
  const cloth = useRef<ToolFrame>(toolFrame());
  const spinning = useRef(0);
  const lightBar = useRef<Group>(null);
  const workLight = useRef<PointLight>(null);
  const arms = useRef<(Mesh | null)[]>([]);
  const aim = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const { act: a, dwell: d } = act.current;
    const cf = car.current;

    // Defaults each frame; the act below overrides what it uses.
    spray.current.on = 0;
    lance.current.on = 0;
    brush.current.on = 0;
    polisher.current.on = 0;
    cloth.current.on = 0;
    spinning.current = 0;
    cf.dull = a < 4 ? 1 : a === 4 ? 1 : 0;
    cf.correctSweep = a === 4 ? unlerp(0.1, 0.9, d) : a > 4 ? 1 : 0;
    cf.foam = 0;
    cf.washSweep = 0;
    cf.haze = 0;
    cf.hazeSweep = 0;
    cf.chassisDirt = a < 2 ? 1 : a === 2 ? 1 : 0;
    cf.chassisSweep = a === 2 ? unlerp(0.4, 0.8, d) : a > 2 ? 1 : 0;
    if (lightBar.current) lightBar.current.visible = false;
    if (workLight.current) workLight.current.intensity = 0;

    /** Point the lance from `hx,hy,hz` at `target`; the nozzle is 0.75 m along the wand. */
    const lanceAt = (hx: number, hy: number, hz: number, target: Vector3, on: number) => {
      const l = lance.current;
      l.position.set(hx, hy, hz);
      aim.subVectors(target, l.position).normalize();
      l.aim.copy(aim);
      l.on = 1;
      spray.current.origin.copy(l.position).addScaledVector(aim, 0.75);
      spray.current.target.copy(target);
      spray.current.on = on;
    };
    /** A tool held flat on the paint at `x,y,z`, its working face down. */
    const onSurface = (t: ToolFrame, x: number, y: number, z: number) => {
      t.position.set(x, y, z);
      t.aim.set(0, -1, 0);
      t.on = 1;
    };

    if (a === 1) {
      // Wash: foam first from the near wing, then the jet nose to tail along the flank.
      const foaming = d < 0.3;
      cf.foam = smooth(unlerp(0.02, 0.22, d));
      const s = unlerp(0.3, 1, d);
      cf.washSweep = s;
      const tz = foaming ? lerp(-1.6, 1.4, smooth(unlerp(0.02, 0.28, d))) : lerp(NOSE, TAIL, s);
      const ty = foaming ? 0.9 + 0.2 * Math.sin(d * 60) : 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(s * 28));
      const target = new Vector3(FLANK_X, ty, tz);
      lanceAt(-2.05, 1.05, tz - 0.3, target, foaming ? 0.5 : 1);
    } else if (a === 2) {
      // Under: the lift takes the car up, the wheels come off, he crouches under it
      // with the jet, then the brush on the front arch.
      const lifted = cf.lift;
      const s = unlerp(0.4, 0.8, d);
      const brushing = d > 0.82;
      if (!brushing) {
        const target = new Vector3(0.3, 0.32 + lifted * BAY.liftHeight, lerp(NOSE + 0.3, TAIL - 0.3, s));
        if (d > 0.36 && d < 0.82) lanceAt(-1.35, 0.55 + lifted * 0.1, target.z - 0.5, target, d > 0.4 && d < 0.8 ? 1 : 0);
      } else {
        // The arch brush, working the front-left arch with the wheel off.
        const b = brush.current;
        b.position.set(-0.98, 0.5 + lifted * BAY.liftHeight + 0.12 * Math.sin(d * 90), -1.45);
        b.aim.set(1, -0.2, 0).normalize();
        b.on = 1;
      }
      if (workLight.current) workLight.current.intensity = 2.5 * lifted;
    } else if (a === 3) {
      // Inside: kneeling at the open door, the brush across the seat and carpet.
      const t = unlerp(0.12, 0.9, d);
      const row = Math.floor(t * 5) / 5;
      onSurface(brush.current, -0.62 + 0.3 * (0.5 + 0.5 * Math.sin(t * 46)), 0.72 + (row > 0.6 ? 0.18 : 0), -0.05 + row * 0.9);
    } else if (a === 4) {
      // Correct: the polisher in cross-hatch passes down the left of the bonnet and
      // roof, the light bar over it; the paint comes up behind the sweep.
      const s = unlerp(0.1, 0.9, d);
      const tz = lerp(NOSE + 0.2, TAIL - 0.3, s);
      const tx = 0.5 - 0.5 * Math.sin(s * 34);
      onSurface(polisher.current, tx, topAt(tz), tz);
      spinning.current = d > 0.1 && d < 0.9 ? 1 : 0;
      if (lightBar.current) {
        lightBar.current.visible = true;
        lightBar.current.position.set(0.3, 2.15, tz);
      }
    } else if (a === 5) {
      // Protect: the coating goes on and hazes the car; the cloth takes it off panel by panel.
      cf.haze = smooth(unlerp(0.02, 0.22, d));
      const s = unlerp(0.3, 0.95, d);
      cf.hazeSweep = s;
      const tz = lerp(NOSE + 0.2, TAIL - 0.3, s);
      const tx = 0.5 - 0.5 * Math.sin(s * 30);
      onSurface(cloth.current, tx, topAt(tz), tz);
    }

    // The lift arms: from each post foot to the pads under the sills, rising with the car.
    const pads: [number, number][] = [
      [-1, -1.15],
      [-1, 1.15],
      [1, -1.15],
      [1, 1.15],
    ];
    arms.current.forEach((m, i) => {
      const p = pads[i];
      if (!m || !p) return;
      const [sx, pz] = p;
      const from = new Vector3(sx * (CAR.width / 2 + 1.5), 0.2, 0);
      const to = new Vector3(sx * 0.85, 0.2 + cf.lift * BAY.liftHeight, pz);
      m.position.copy(from).add(to).multiplyScalar(0.5);
      m.scale.set(1, 1, from.distanceTo(to));
      m.lookAt(to);
    });
  });

  return (
    <group>
      <FreeTool frame={lance}>
        <Lance />
      </FreeTool>
      <FreeTool frame={brush}>
        <Brush />
      </FreeTool>
      <FreeTool frame={polisher}>
        <Polisher spinning={spinning} />
      </FreeTool>
      <FreeTool frame={cloth}>
        <Cloth />
      </FreeTool>
      <Spray count={mobile ? 700 : 1600} frame={spray} />

      {/* The inspection light bar over the bonnet in act 5. */}
      <group ref={lightBar} visible={false}>
        <mesh>
          <boxGeometry args={[1.5, 0.06, 0.12]} />
          <meshBasicMaterial color={[3.2, 3.3, 3.6]} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[1.6, 0.06, 0.2]} />
          <meshStandardMaterial color="#15161a" roughness={0.6} />
        </mesh>
        <pointLight color="#eef2ff" intensity={14} distance={4} decay={2} position={[0, -0.1, 0]} />
      </group>

      {/* The work light under the car in act 3. */}
      <pointLight ref={workLight} color="#fff3d6" intensity={0} distance={5} decay={2} position={[0, 0.25, 0]} />

      {/* The lift's four arms. */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            arms.current[i] = m;
          }}
        >
          <boxGeometry args={[0.12, 0.1, 1]} />
          <meshStandardMaterial color="#1f2a66" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

const upAxis = new Vector3(0, 1, 0);

/**
 * A tool on its own in the scene, positioned and pointed each frame. The tools are
 * built with their working end along +Y, so the group's +Y is turned onto `aim`.
 */
function FreeTool({ frame, children }: { frame: React.MutableRefObject<ToolFrame>; children: React.ReactNode }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    const node = g.current;
    if (!node) return;
    const f = frame.current;
    node.visible = f.on > 0.5;
    node.position.copy(f.position);
    node.quaternion.setFromUnitVectors(upAxis, f.aim);
  });
  return <group ref={g}>{children}</group>;
}
