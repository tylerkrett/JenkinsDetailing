"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { type Mesh } from "three";

/**
 * The tools, built from primitives. Each has its working end along +Y so the scene can
 * point it with one quaternion.
 */

/** The pressure-washer lance: a long wand with a trigger grip and a brass nozzle. */
export function Lance() {
  return (
    <group>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.72, 8]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.02, 0.028, 0.06, 8]} />
        <meshStandardMaterial color="#c9a24a" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, -0.02, -0.06]}>
        <boxGeometry args={[0.03, 0.05, 0.12]} />
        <meshStandardMaterial color="#15161a" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.035, 0.14, 0.05]} />
        <meshStandardMaterial color="#15161a" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** A stiff detailing brush for arches, carpets and seats. */
export function Brush() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.014, 0.018, 0.22, 8]} />
        <meshStandardMaterial color="#2247d6" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.05, 0.06, 0.09]} />
        <meshStandardMaterial color="#dfe3e8" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** The dual-action polisher: a body in the hand, a pad that spins while it works. */
export function Polisher({ spinning }: { spinning: React.MutableRefObject<number> }) {
  const pad = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (pad.current) pad.current.rotation.y += dt * 22 * spinning.current;
  });
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.09, 0.2, 0.09]} />
        <meshStandardMaterial color="#15161a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.11, 0.04, 0.11]} />
        <meshStandardMaterial color="#f2f3f4" roughness={0.6} />
      </mesh>
      <mesh ref={pad} position={[0, 0.24, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.078, 0.078, 0.035, 20]} />
        <meshStandardMaterial color="#f4d35e" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** A folded microfibre cloth. */
export function Cloth() {
  return (
    <mesh position={[0, 0.05, 0]}>
      <boxGeometry args={[0.2, 0.03, 0.16]} />
      <meshStandardMaterial color="#2ec4b6" roughness={1} />
    </mesh>
  );
}
