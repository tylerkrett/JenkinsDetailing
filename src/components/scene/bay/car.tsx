"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Color, type Group, type Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D, Vector3 } from "three";

import { carModelUrl } from "~/lib/scene/assets";
import { BAY } from "~/lib/scene/bay-layout";
import { patchChassis, patchPaint, patchShell, sweepUniforms, tickShell } from "~/lib/scene/sweep";

/** The hero paint: a deep metallic blue near the accent, clearcoated. */
const PAINT = new Color("#132264");

export type CarFrame = {
  /** 0..1 how far the car has driven in from the road (act 1). */
  driveIn: number;
  /** Sideways offset and heading during the drive-in (the lane, the turn in). */
  x: number;
  yaw: number;
  /** 0..1 how high the lift has taken it (act 3). */
  lift: number;
  /** 0..1 how far the wheels are off and set aside (act 3). */
  wheelsOff: number;
  /** 0..1 how far the driver's door is open (act 4). */
  door: number;
  /** 0..1 headlights on (act 1). */
  headlights: number;
  /** Process state, written by the choreography each frame. */
  dull: number;
  correctSweep: number;
  foam: number;
  washSweep: number;
  haze: number;
  hazeSweep: number;
  chassisDirt: number;
  chassisSweep: number;
};

type Props = {
  mobile: boolean;
  frame: React.MutableRefObject<CarFrame>;
  /** Where the car starts its drive-in, along +z. */
  driveFromZ: number;
};

function isMesh(o: Object3D): o is Mesh {
  return (o as Mesh).isMesh === true;
}

/**
 * The hero car: the Khronos 3D Commerce concept coupe (CC BY 4.0). Its geometry is
 * Z-up under a root node that turns it Y-up; it is placed on the bay floor with the
 * nose toward -Z. Every paint material is replaced by the bay's paint so the finish can be
 * driven per act; the wheels and the driver's door are found by name so the lift and
 * the cabin act can move them.
 */
export function Car({ mobile, frame, driveFromZ }: Props) {
  const url = carModelUrl(mobile);
  const gltf = useGLTF(url, false, true);
  const root = useRef<Group>(null);

  const paint = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: PAINT,
        metalness: 0.75,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.2,
      }),
    [],
  );
  const rubber = useMemo(() => new MeshStandardMaterial({ color: "#15161a", roughness: 0.92, metalness: 0 }), []);
  /** The underside and running gear: matte, grimy, never a mirror. */
  const chassis = useMemo(() => new MeshStandardMaterial({ color: "#2a2c30", roughness: 0.88, metalness: 0.25 }), []);
  /** Foam and coating haze as shells over the paint, driven by the sweeps. */
  const foam = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#f6f8fb",
        roughness: 0.95,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  const haze = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#e3e9f0",
        roughness: 0.75,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  );
  const uniforms = useMemo(
    () => ({ paint: sweepUniforms(), chassis: sweepUniforms(), foam: sweepUniforms(), haze: sweepUniforms() }),
    [],
  );
  useEffect(() => {
    patchPaint(paint, uniforms.paint);
    patchChassis(chassis, uniforms.chassis);
    patchShell(foam, uniforms.foam, "foam");
    patchShell(haze, uniforms.haze, "haze");
  }, [paint, chassis, foam, haze, uniforms]);
  useEffect(
    () => () => {
      paint.dispose();
      rubber.dispose();
      chassis.dispose();
      foam.dispose();
      haze.dispose();
    },
    [paint, rubber, chassis, foam, haze],
  );

  // Prepare the scene once: paint, shadows, the floor offset, and the movable parts.
  const parts = useMemo(() => {
    const scene = gltf.scene;
    const replaced: Material[] = [];
    const painted: Mesh[] = [];
    scene.traverse((o) => {
      if (!isMesh(o)) return;
      o.castShadow = true;
      // The sample's number plate carries the Khronos mark; the plate goes.
      if (/License/i.test(o.name)) o.visible = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        if (/^Paint/i.test(m.name)) {
          replaced.push(m);
          painted.push(o);
          return paint;
        }
        // The sidewall texture carries the 3D Commerce mark; plain rubber instead.
        if (/^Tireside/i.test(m.name)) {
          replaced.push(m);
          return rubber;
        }
        if (/^Mechanical/i.test(m.name)) {
          replaced.push(m);
          return chassis;
        }
        return m;
      });
      o.material = Array.isArray(o.material) ? next : next[0]!;
    });
    for (const m of replaced) m.dispose();
    // Shells: the same geometry again over every painted panel, for foam and haze.
    for (const mesh of painted) {
      for (const mat of [foam, haze]) {
        const shell = new Mesh(mesh.geometry, mat);
        shell.position.copy(mesh.position);
        shell.quaternion.copy(mesh.quaternion);
        shell.scale.copy(mesh.scale);
        shell.renderOrder = mat === foam ? 2 : 1;
        shell.frustumCulled = false;
        mesh.parent?.add(shell);
      }
    }

    // The root node already turns the Z-up geometry to Y-up; that leaves the nose toward
    // +Z, so a half turn about Y points it into the bay.
    scene.rotation.set(0, Math.PI, 0);
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    // Tyres on the floor, car centred on the origin.
    const centre = box.getCenter(new Vector3());
    scene.position.set(-centre.x, -box.min.y, -centre.z);
    scene.updateMatrixWorld(true);

    const byName = (re: RegExp) => {
      const out: Object3D[] = [];
      scene.traverse((o) => {
        if (re.test(o.name)) out.push(o);
      });
      return out;
    };
    const wheels = byName(/^Wheel(Front|Rear)[LR]$/);
    const door = byName(/^BodyDoorLColor1$/)[0] ?? null;
    // Lamps: the headlight material glows while the car drives in.
    const lamps: MeshStandardMaterial[] = [];
    scene.traverse((o) => {
      if (!isMesh(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (/^Headlight/i.test(m.name) && (m as MeshStandardMaterial).isMeshStandardMaterial) lamps.push(m as MeshStandardMaterial);
    });
    for (const m of lamps) {
      m.emissive = new Color("#dfe9ff");
      m.emissiveIntensity = 0;
      m.toneMapped = false;
    }
    // Wheel radius from the front-left tyre, for the roll.
    const wheelBox = wheels[0] ? new Box3().setFromObject(wheels[0]) : null;
    const radius = wheelBox ? (wheelBox.max.y - wheelBox.min.y) / 2 : 0.36;
    return {
      wheels: wheels.map((w) => ({ node: w, rest: w.position.clone(), quat: w.quaternion.clone() })),
      door: door ? { node: door, quat: door.quaternion.clone() } : null,
      lamps,
      radius,
      length: box.max.z - box.min.z,
    };
  }, [gltf.scene, paint, rubber, chassis, foam, haze]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const f = frame.current;
    uniforms.paint.uAmount.value = f.dull;
    uniforms.paint.uSweep.value = f.correctSweep;
    uniforms.chassis.uAmount.value = f.chassisDirt;
    uniforms.chassis.uSweep.value = f.chassisSweep;
    uniforms.foam.uAmount.value = f.foam;
    uniforms.foam.uSweep.value = f.washSweep;
    uniforms.haze.uAmount.value = f.haze;
    uniforms.haze.uSweep.value = f.hazeSweep;
    tickShell(foam, dt);
    tickShell(haze, dt);
    const drive = driveFromZ * (1 - f.driveIn);
    g.position.set(f.x, f.lift * BAY.liftHeight, drive);
    g.rotation.y = f.yaw;

    // Wheels roll with the drive-in (angle = distance / radius about the axle, the
    // model's local X), and come off in act 3: each drops to the floor beside the car.
    // In the model's local frame "outward" is X and "down" is -Z.
    const roll = drive / parts.radius;
    for (const w of parts.wheels) {
      const side = w.rest.x < 0 ? -1 : 1;
      w.node.position.copy(w.rest);
      // Off the car they stand by the posts: further out, pulled toward the middle, on the floor.
      w.node.position.x += side * 1.35 * f.wheelsOff;
      w.node.position.y -= w.rest.y * 0.55 * f.wheelsOff;
      w.node.position.z -= f.lift * BAY.liftHeight * f.wheelsOff;
      w.node.quaternion.copy(w.quat);
      w.node.rotateX(roll);
    }
    for (const m of parts.lamps) m.emissiveIntensity = 3.5 * f.headlights;

    // The driver's door swings open about its hinge at the front edge.
    if (parts.door) {
      parts.door.node.quaternion.copy(parts.door.quat);
      parts.door.node.rotateZ(-f.door * 1.05);
    }
  });

  return (
    <group ref={root} position={[0, 0, driveFromZ]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

/** Warm the cache as soon as the module loads on a capable device. */
export function preloadCar(mobile: boolean) {
  useGLTF.preload(carModelUrl(mobile), false, true);
}
