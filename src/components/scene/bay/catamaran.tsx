"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Group, type Mesh, type MeshStandardMaterial } from "three";

import { clamp, lerp, unlerp } from "~/lib/motion";
import { BAY, dwellStart, totalTravel } from "~/lib/scene/bay-layout";
import { useScene } from "~/lib/scene/store";

type Props = { mobile: boolean };

const Z = BAY.shutterZ;

/** Half the distance between the hulls, and how long each one is. */
const BEAM = 1.55;
const LOA = 8.4;
/** How high the cradle stands the hulls off the yard. */
const KEEL = 1.55;

/** Salt and winter dirt, and the gelcoat under it. */
const GRIMY = new Color("#767c72");
const GELCOAT = new Color("#eef1f5");

/** Where the wash head starts and finishes its pass along the hull. */
const RUN = LOA / 2 - 0.7;

/**
 * A catamaran up on its cradle beside the second bay, being washed down. The boat is
 * winter-dirty when the page opens and comes up clean over the drive in, so the first
 * thing the scroll does is show the work: the head tracks the length of the hull, the
 * foam follows it, and the gelcoat brightens behind it.
 *
 * Nothing here is a person; the head works on its own, as the tools inside the bay do.
 */
export function Catamaran({ mobile }: Props) {
  const hullMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const grime = useRef<(MeshStandardMaterial | null)[]>([]);
  const head = useRef<Group>(null);
  const foam = useRef<Group>(null);
  const drip = useRef<Mesh>(null);

  // The cradle: three stands under each hull, each a foot with a raking prop.
  const stands = useMemo(() => [-2.7, 0, 2.7], []);

  useFrame(() => {
    const { progress, world } = useScene.getState();
    const total = world?.totalTravel ?? totalTravel();
    const u = clamp(progress, 0, 1) * total;
    // The wash runs over the drive in and is finished by the time the car pulls up.
    const t = unlerp(0.5, dwellStart(0) - 0.5, u);

    // The head sweeps from the transom to the bow, then parks at the bow.
    const sweep = clamp(t * 1.08, 0, 1);
    const x = lerp(-RUN, RUN, sweep);
    if (head.current) {
      head.current.position.x = x;
      head.current.position.y = KEEL + 0.62 + Math.sin(sweep * Math.PI * 7) * 0.06;
    }
    if (foam.current) {
      foam.current.position.x = x - 0.5;
      foam.current.visible = t > 0.02 && t < 0.99;
    }
    if (drip.current) {
      drip.current.scale.setScalar(lerp(0.4, 1.15, Math.sin(clamp(t, 0, 1) * Math.PI)));
    }

    // The gelcoat comes up behind the head: each hull cleans along its length.
    for (const m of hullMats.current) {
      if (!m) continue;
      m.color.lerpColors(GRIMY, GELCOAT, t);
      m.roughness = lerp(0.86, 0.22, t);
      m.metalness = lerp(0, 0.12, t);
    }
    for (const m of grime.current) {
      if (!m) continue;
      m.opacity = (1 - t) * 0.5;
      m.visible = m.opacity > 0.01;
    }
  });

  return (
    // Washed down over the drive-in, so it changes every frame: never merged with the scenery.
    <group position={[15.5, 0, Z + 9.4]} rotation={[0, -0.14, 0]} userData={{ noBatch: true }}>
      {/* The cradle under each hull. */}
      {[-1, 1].map((sz) =>
        stands.map((sx) => (
          <group key={`${sz}${sx}`} position={[sx, 0, sz * BEAM]}>
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[0.7, 0.16, 1.1]} />
              <meshStandardMaterial color="#3b3f45" roughness={0.8} metalness={0.2} />
            </mesh>
            <mesh position={[0, KEEL / 2, 0]}>
              <boxGeometry args={[0.16, KEEL, 0.16]} />
              <meshStandardMaterial color="#6d3a2c" roughness={0.7} metalness={0.25} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0, KEEL / 2 - 0.1, s * 0.34]} rotation={[s * 0.42, 0, 0]}>
                <boxGeometry args={[0.11, KEEL, 0.11]} />
                <meshStandardMaterial color="#6d3a2c" roughness={0.7} metalness={0.25} />
              </mesh>
            ))}
            <mesh position={[0, KEEL + 0.06, 0]}>
              <boxGeometry args={[0.5, 0.14, 0.62]} />
              <meshStandardMaterial color="#2a2d33" roughness={0.9} />
            </mesh>
          </group>
        )),
      )}

      {/* The two hulls, and the winter's dirt still on them. */}
      {[-1, 1].map((sz, i) => (
        <group key={sz} position={[0, KEEL + 0.62, sz * BEAM]}>
          <mesh scale={[LOA / 2, 0.46, 0.5]}>
            <sphereGeometry args={[1, mobile ? 12 : 18, mobile ? 8 : 12]} />
            <meshStandardMaterial
              ref={(m) => {
                hullMats.current[i] = m;
              }}
              color={GRIMY}
              roughness={0.86}
            />
          </mesh>
          {/* The dirt as a skin just proud of the hull, fading as the head passes. */}
          <mesh scale={[LOA / 2 + 0.02, 0.482, 0.522]}>
            <sphereGeometry args={[1, mobile ? 10 : 14, mobile ? 6 : 10]} />
            <meshStandardMaterial
              ref={(m) => {
                grime.current[i] = m;
              }}
              color="#4c4a3e"
              roughness={1}
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </mesh>
          {/* Boot top and a dark antifoul band under it. */}
          <mesh position={[0, -0.13, 0]} scale={[LOA / 2 - 0.05, 0.13, 0.53]}>
            <sphereGeometry args={[1, 14, 6]} />
            <meshStandardMaterial color="#1b3550" roughness={0.6} />
          </mesh>
          {/* A flat deck along the top, so the hull has a sheer rather than a dome. */}
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[LOA - 1.5, 0.1, 0.84]} />
            <meshStandardMaterial color="#dfe3e7" roughness={0.55} />
          </mesh>
        </group>
      ))}

      {/* The bridgedeck across the hulls, the coachroof and the mast. */}
      <mesh position={[0, KEEL + 1.16, 0]}>
        <boxGeometry args={[LOA - 1.9, 0.16, BEAM * 2 + 0.5]} />
        <meshStandardMaterial color="#dfe3e7" roughness={0.5} />
      </mesh>
      <mesh position={[-0.5, KEEL + 1.58, 0]}>
        <boxGeometry args={[3.1, 0.7, 2.3]} />
        <meshStandardMaterial color="#e8ebee" roughness={0.45} />
      </mesh>
      <mesh position={[-0.5, KEEL + 1.62, 1.17]}>
        <planeGeometry args={[2.6, 0.36]} />
        <meshStandardMaterial color="#10161f" roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh position={[0.35, KEEL + 4.5, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 5.6, 8]} />
        <meshStandardMaterial color="#b9bfc6" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh position={[-0.7, KEEL + 2.2, 0]}>
        <boxGeometry args={[2.4, 0.16, 0.16]} />
        <meshStandardMaterial color="#b9bfc6" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Her name on the transom end of the bridgedeck. */}
      <mesh position={[LOA / 2 - 1.15, KEEL + 1.02, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.1, 0.24, 1.5]} />
        <meshStandardMaterial color="#1b3550" roughness={0.5} />
      </mesh>

      {/* The wash head working the outboard hull, and the foam it leaves. */}
      <group ref={head} position={[-RUN, KEEL + 0.62, BEAM + 0.72]}>
        <mesh>
          <boxGeometry args={[0.42, 0.2, 0.26]} />
          <meshStandardMaterial color="#1d3f8a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.16]}>
          <boxGeometry args={[0.46, 0.26, 0.08]} />
          <meshStandardMaterial color="#e9ecef" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.42, 0.06]}>
          <cylinderGeometry args={[0.035, 0.035, 0.8, 6]} />
          <meshStandardMaterial color="#8c8f95" roughness={0.5} metalness={0.5} />
        </mesh>
      </group>
      <group ref={foam} position={[-RUN, KEEL + 0.6, BEAM + 0.64]}>
        {(mobile ? [0] : [0, 1, 2, 3]).map((i) => (
          <mesh key={i} position={[-i * 0.34, 0.12 - i * 0.16, -0.06 + i * 0.02]}>
            <sphereGeometry args={[0.19 - i * 0.028, 7, 5]} />
            <meshStandardMaterial color="#f2f6f8" roughness={0.85} transparent opacity={0.62 - i * 0.11} />
          </mesh>
        ))}
      </group>
      {/* The wet patch the run-off leaves on the yard under her. */}
      <mesh ref={drip} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, BEAM + 0.45]}>
        <circleGeometry args={[1.5, 16]} />
        <meshStandardMaterial color="#080b12" roughness={0.2} metalness={0.5} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
