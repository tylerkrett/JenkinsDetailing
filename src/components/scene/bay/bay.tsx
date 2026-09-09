"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Color, Fog, type Group, type Mesh, type SpotLight } from "three";

import { lerp, unlerp } from "~/lib/motion";
import { ACT_COUNT, BAY, CAR, DRIVE_FROM_Z, DWELL_SPAN, actState, carX, carYaw, carZ, dwellStart, totalTravel } from "~/lib/scene/bay-layout";
import {
  LIME,
  makeBlockworkTexture,
  makeBottlesTexture,
  makePosterTexture,
  makeShutterTexture,
  makeSignTexture,
  makeTileTexture,
  makeToolWallTexture,
} from "~/lib/scene/bay-textures";
import { current } from "~/lib/scene/enter";
import { resetFx } from "~/lib/scene/fx";
import { useScene } from "~/lib/scene/store";

import { Car, type CarFrame } from "./car";
import { Exterior } from "./exterior";
import { type ActFrame, Process } from "./process";

/** Blue-black evening; fog and background share it. */
const NIGHT = new Color("#0a0d16");
const FOG_NEAR = 26;
const FOG_FAR = 95;

/** Floor tile pitch in metres. */
const TILE = 0.5;

type Props = { mobile: boolean };

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The bay's meshes: the unit as the client has it (black and yellow-green tiles, white
 * blockwork, flat LED panels, shelves of bottles, a tool wall, the CARPRO sign, a
 * cabinet and a trolley), the roller shutter and the forecourt beyond it, and the car.
 * The world layout itself is published by the DOM side (bay-experience.tsx).
 */
export function Bay({ mobile }: Props) {
  const scene = useThree((s) => s.scene);

  const car = useRef<Group>(null);
  const carFrame = useRef<CarFrame>({
    driveIn: 0,
    x: 0,
    yaw: 0,
    lift: 0,
    wheelsOff: 0,
    door: 0,
    headlights: 0,
    dull: 1,
    grime: 1,
    correctSweep: 0,
    foam: 0,
    washSweep: 0,
    haze: 0,
    hazeSweep: 0,
    chassisDirt: 1,
    chassisSweep: 0,
  });
  const actFrame = useRef<ActFrame>({ act: 0, dwell: 0, approach: 0 });
  const panels = useRef<(Mesh | null)[]>([]);
  const spots = useRef<(SpotLight | null)[]>([]);

  const cellsX = Math.round((BAY.halfW * 2) / TILE);
  const cellsY = Math.round(BAY.length / TILE);
  const tex = useMemo(() => {
    // The green: a two-tile border down each side, a band across the front and a
    // single stripe across the middle, the way the client's unit is laid.
    const tiles = makeTileTexture(cellsX, cellsY, (x, y) => {
      const edge = x < 2 || x >= cellsX - 2;
      const front = y >= cellsY - 3;
      const stripe = y === Math.round(cellsY * 0.42) || y === Math.round(cellsY * 0.42) + 1;
      return edge || front || stripe;
    });
    const wall = makeBlockworkTexture();
    wall.repeat.set(3, 1.2);
    return {
      tiles,
      wall,
      shutter: makeShutterTexture(),
      carpro: makeSignTexture("CARPRO", { width: 1024, height: 256 }),
      bottles: makeBottlesTexture(5),
      bottles2: makeBottlesTexture(9),
      tools: makeToolWallTexture(),
      poster: makePosterTexture(),
    };
  }, [cellsX, cellsY]);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);

  useEffect(() => {
    scene.fog = new Fog(NIGHT.clone(), FOG_NEAR, FOG_FAR);
    scene.background = NIGHT.clone();
    return () => {
      scene.fog = null;
      resetFx();
    };
  }, [scene]);

  const lightIntensity = mobile ? 0.9 : 1.2;

  useFrame(() => {
    const { progress, station, world } = useScene.getState();
    const total = world?.totalTravel ?? totalTravel();
    const { act, approach, dwell } = actState(progress, total);
    actFrame.current.act = act;
    actFrame.current.dwell = dwell;
    actFrame.current.approach = approach;
    current.index = station;
    current.seated = act === station && approach >= 0.999;

    // After the reveal the bay lights fall to a glow so the page beneath reads.
    const u = progress * total;
    const afterReveal = unlerp(dwellStart(ACT_COUNT - 1) + DWELL_SPAN, dwellStart(ACT_COUNT - 1) + DWELL_SPAN + 10, u);
    const dimmed = 1 - afterReveal * 0.85;
    spots.current.forEach((sp, i) => {
      if (sp) sp.intensity = (i === 0 ? 80 : 55) * lightIntensity * dimmed;
    });
    panels.current.forEach((m) => {
      if (m) m.visible = afterReveal < 0.5;
    });

    // The car drives in from the road over the opening scroll, pulls up on the forecourt
    // for the first hold, and rolls into the bay over its dwell (see carZ). Act 3: the
    // lift takes it up, the wheels come off, and both return at the end of the dwell.
    // Act 4: the door.
    const driveIn = act > 0 ? 1 : 1 - carZ(u) / DRIVE_FROM_Z;
    const lift = act === 2 ? Math.sin(Math.min(1, dwell / 0.25) * Math.PI * 0.5) * (1 - smooth(Math.max(0, (dwell - 0.85) / 0.15))) : 0;
    const wheelsOff = act === 2 ? smooth(unlerp(0.25, 0.45, dwell)) * (1 - smooth(unlerp(0.8, 0.92, dwell))) : 0;
    const door = act === 3 ? smooth(unlerp(0, 0.12, dwell)) * (1 - smooth(unlerp(0.9, 1, dwell))) : 0;
    const cf = carFrame.current;
    cf.driveIn = driveIn;
    cf.x = act > 0 ? 0 : carX(u);
    cf.yaw = act > 0 ? 0 : carYaw(u);
    cf.lift = lift;
    cf.wheelsOff = wheelsOff;
    cf.door = door;
    // Headlights: on for the drive-in until parked; on again at the end of the reveal.
    cf.headlights = act === 0 ? 1 - smooth(unlerp(0.86, 1, dwell)) : act === ACT_COUNT - 1 ? smooth(unlerp(0.7, 0.85, dwell)) : 0;
    const g = car.current;
    if (g) g.position.set(cf.x, lift * BAY.liftHeight, lerp(DRIVE_FROM_Z, 0, driveIn));
  });

  const W = BAY.halfW;
  const L = BAY.length;
  const H = BAY.height;
  const panelCols = [-2.2, 2.2];
  const panelRows = [-4.5, -1.5, 1.5, 4.5];

  return (
    <group>
      {/* The bay as a reflection: white walls and the ceiling panels, baked once into a cubemap
          so the paint has something to mirror. No files, nothing fetched. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#1a1d24"]} />
        {panelRows.flatMap((z) =>
          panelCols.map((x) => (
            <Lightformer key={`${x}${z}`} form="rect" intensity={5} color="#e8eeff" position={[x, H - 0.05, z]} rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 0.6, 1]} />
          )),
        )}
        <Lightformer form="rect" intensity={0.9} color="#d6dae0" position={[-W, 1.8, 0]} rotation={[0, Math.PI / 2, 0]} scale={[L, 3.6, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#d6dae0" position={[W, 1.8, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[L, 3.6, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#d6dae0" position={[0, 1.8, -L / 2]} scale={[W * 2, 3.6, 1]} />
      </Environment>
      <hemisphereLight color="#9aa6bd" groundColor="#0c0f14" intensity={0.55} />
      <ambientLight intensity={0.14} />

      {/* Flat LED panels in the ceiling: emissive boxes, and two real spots that carry the light. */}
      {panelRows.flatMap((z, ri) =>
        panelCols.map((x, ci) => (
          <mesh
            key={`${x}${z}`}
            ref={(m) => {
              panels.current[ri * 2 + ci] = m;
            }}
            position={[x, H - 0.04, z]}
          >
            <boxGeometry args={[1.2, 0.06, 0.6]} />
            <meshBasicMaterial color={new Color(1.7, 1.8, 2.0)} toneMapped={false} />
          </mesh>
        )),
      )}
      <spotLight
        ref={(l) => {
          spots.current[0] = l;
        }}
        position={[0, H - 0.1, 0.5]}
        angle={1.15}
        penumbra={0.7}
        intensity={80 * lightIntensity}
        color="#e3e9ff"
        distance={26}
        decay={2}
        castShadow={!mobile}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <spotLight
        ref={(l) => {
          spots.current[1] = l;
        }}
        position={[0, H - 0.1, -4]}
        angle={1.05}
        penumbra={0.7}
        intensity={55 * lightIntensity}
        color="#e3e9ff"
        distance={22}
        decay={2}
      />

      {/* Floor: the tiles inside. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W * 2, L]} />
        <meshStandardMaterial map={tex.tiles} roughness={0.55} metalness={0.05} />
      </mesh>
      {!mobile ? (
        <ContactShadows position={[0, 0.01, 0]} scale={[8, 12]} blur={2.2} opacity={0.6} far={1.6} resolution={512} frames={Infinity} />
      ) : null}

      {/* Walls, ceiling and the back. */}
      <mesh position={[-W, H / 2, 0]}>
        <boxGeometry args={[0.2, H, L]} />
        <meshStandardMaterial map={tex.wall} roughness={0.92} />
      </mesh>
      <mesh position={[W, H / 2, 0]}>
        <boxGeometry args={[0.2, H, L]} />
        <meshStandardMaterial map={tex.wall} roughness={0.92} />
      </mesh>
      <mesh position={[0, H / 2, -L / 2]}>
        <boxGeometry args={[W * 2, H, 0.2]} />
        <meshStandardMaterial map={tex.wall} roughness={0.92} />
      </mesh>
      <mesh position={[0, H + 0.1, 0]}>
        <boxGeometry args={[W * 2, 0.2, L]} />
        <meshStandardMaterial color="#b9bec6" roughness={1} />
      </mesh>

      {/* The CARPRO sign high on the back wall, the poster beside it. */}
      <mesh position={[1.4, H - 0.75, -L / 2 + 0.12]}>
        <planeGeometry args={[2.6, 0.65]} />
        <meshStandardMaterial map={tex.carpro} roughness={0.6} />
      </mesh>
      <mesh position={[-2.6, 2.2, -L / 2 + 0.12]}>
        <planeGeometry args={[1.2, 0.9]} />
        <meshStandardMaterial map={tex.poster} roughness={0.5} />
      </mesh>

      {/* Left wall: two shelving units full of bottles. */}
      {[-3.6, 0.4].map((z, i) => (
        <group key={z} position={[-W + 0.11, 0, z]}>
          {[0.75, 1.35, 1.95].map((y, j) => (
            <group key={y}>
              <mesh position={[0.2, y, 0]}>
                <boxGeometry args={[0.4, 0.04, 2.6]} />
                <meshStandardMaterial color="#2b2e34" roughness={0.7} metalness={0.4} />
              </mesh>
              <mesh position={[0.22, y + 0.24, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[2.5, 0.44]} />
                <meshStandardMaterial map={(i + j) % 2 ? tex.bottles : tex.bottles2} roughness={0.5} transparent />
              </mesh>
            </group>
          ))}
          <mesh position={[0.2, 1.3, -1.32]}>
            <boxGeometry args={[0.42, 2.6, 0.04]} />
            <meshStandardMaterial color="#2b2e34" roughness={0.7} metalness={0.4} />
          </mesh>
          <mesh position={[0.2, 1.3, 1.32]}>
            <boxGeometry args={[0.42, 2.6, 0.04]} />
            <meshStandardMaterial color="#2b2e34" roughness={0.7} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Right wall: the tool slatwall, a cabinet and a trolley. */}
      <mesh position={[W - 0.11, 1.75, -2.4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.6, 1.8]} />
        <meshStandardMaterial map={tex.tools} roughness={0.7} />
      </mesh>
      <mesh position={[W - 0.5, 0.5, 1.6]} castShadow>
        <boxGeometry args={[0.7, 1.0, 1.4]} />
        <meshStandardMaterial color="#c8102e" roughness={0.45} metalness={0.5} />
      </mesh>
      <mesh position={[W - 0.5, 0.42, 4.2]} castShadow>
        <boxGeometry args={[0.6, 0.84, 0.9]} />
        <meshStandardMaterial color="#2b2e34" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* The front: wall either side of the door, the shutter drum above it, the shutter up. */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (W / 2 + 1.55), H / 2, BAY.shutterZ]}>
          <boxGeometry args={[W - 3.1, H, 0.3]} />
          <meshStandardMaterial map={tex.wall} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, H - 0.25, BAY.shutterZ]}>
        <boxGeometry args={[6.4, 0.5, 0.5]} />
        <meshStandardMaterial color="#8d939a" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, H - 0.75, BAY.shutterZ]}>
        <planeGeometry args={[6.2, 0.5]} />
        <meshStandardMaterial map={tex.shutter} roughness={0.5} metalness={0.5} side={2} />
      </mesh>

      {/* Everything beyond the shutter: the forecourt, the town, the sky, the rain. */}
      <Exterior mobile={mobile} />

      {/* The car. The primitive stand-in shows while the model streams in. */}
      <Suspense
        fallback={
          <group ref={car} position={[0, 0, DRIVE_FROM_Z]}>
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[CAR.width, 0.6, CAR.length]} />
              <meshPhysicalMaterial color="#1b2f86" roughness={0.35} metalness={0.6} clearcoat={0.6} />
            </mesh>
          </group>
        }
      >
        <Car mobile={mobile} frame={carFrame} driveFromZ={DRIVE_FROM_Z} />
      </Suspense>
      <Process act={actFrame} car={carFrame} mobile={mobile} />

      {/* The two-post lift: posts either side, arms swung under the sills. */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh position={[sx * (CAR.width / 2 + 1.5), 1.4, 0]} castShadow>
            <boxGeometry args={[0.24, 2.8, 0.34]} />
            <meshStandardMaterial color="#2a3b8f" roughness={0.55} metalness={0.3} />
          </mesh>
          <mesh position={[sx * (CAR.width / 2 + 1.5), 0.12, 0]}>
            <boxGeometry args={[0.6, 0.24, 0.9]} />
            <meshStandardMaterial color="#1f2a66" roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      ))}
      <LimeMarker />
    </group>
  );
}

/** A thin lime line on the floor at the shutter: the threshold, the way the real bay has one. */
function LimeMarker() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, BAY.shutterZ - 0.4]}>
      <planeGeometry args={[6.2, 0.08]} />
      <meshBasicMaterial color={LIME} />
    </mesh>
  );
}
