"use client";

import { useEffect, useMemo } from "react";
import { Color, DoubleSide } from "three";

import { BAY } from "~/lib/scene/bay-layout";
import {
  makeFoliageTexture,
  makePuddleTexture,
  makeSignTexture,
  makeStoneTexture,
} from "~/lib/scene/bay-textures";

const Z = BAY.shutterZ;
/** The railings across the front of the forecourt; the yard runs from the shutter to here. */
const FENCE_Z = Z + 12;

const SODIUM = new Color("#ffb45c");
const LAMP_HEAD = new Color(1.4, 1.05, 0.6);

/** A small seeded generator, so the yard is laid out the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/**
 * Puddles: where the tarmac has settled, standing water. Kept off the line the car
 * drives, so nothing sits under the wheels. [x, z, radius].
 */
const PUDDLES: [number, number, number][] = [
  [5.2, 15.4, 1.5],
  [7.9, 10.4, 1.1],
  [-7.4, 13.8, 1.7],
  [3.9, 8.6, 0.9],
  [-9.8, 17.2, 1.3],
  [10.6, 16.6, 1.4],
  [-5.6, 9.2, 0.8],
  [12.8, 14.6, 1.0],
];

/** Stacks of part-worn tyres against the walls: [x, z, count, rotation]. */
const TYRES: [number, number, number, number][] = [
  [6.05, 8.0, 5, 0.2],
  [6.75, 7.9, 3, -0.5],
  [10.9, 14.2, 4, 0.9],
  [17.6, 14.1, 6, 0.1],
  [-6.2, 7.9, 4, 0.6],
];

/** Traffic cones round the bay being worked in: [x, z]. */
const CONES: [number, number][] = [
  [3.5, 17.9],
  [3.5, 14.6],
  [9.0, 17.9],
  [9.0, 14.6],
  [6.4, 18.1],
  [-4.9, 17.4],
];

/**
 * The Cambrian ridge behind the town: [x, z, radius, height, sides]. Kept inside the
 * sky dome and inside the fog's far plane, so the fog greys them into a horizon rather
 * than swallowing them whole.
 */
const HILLS: [number, number, number, number, number][] = [
  [-46, -30, 24, 15, 6],
  [-20, -50, 26, 19, 5],
  [12, -55, 24, 17, 6],
  [44, -36, 26, 16, 5],
  [-62, -6, 22, 13, 5],
  [64, 2, 24, 14, 6],
  [-4, -68, 30, 21, 7],
];

type Props = { mobile: boolean };

/**
 * Everything standing around the garage that the walls and the road don't already
 * account for: the working yard on the apron (marked bays, puddles, tyres, drums, bins,
 * cones, the air line and the jet wash), the fabric of the front wall itself (doors,
 * downpipes, a hose reel, boards), the boundary the yard sits inside (stone walls,
 * hedge, trees, a lean-to), and the hills behind the town.
 *
 * The car's line is kept clear: it comes down the left lane, swings to the middle at
 * z 12..23 and runs in through the door on x 0, so nothing is placed inside
 * x -4.5..3 for z 0..24.
 */
export function Forecourt({ mobile }: Props) {
  const tex = useMemo(() => {
    const wall = makeStoneTexture(37);
    wall.repeat.set(6, 1);
    const hedge = makeFoliageTexture(43);
    hedge.repeat.set(6, 1);
    const canopy = makeFoliageTexture(47);
    const aboard = makeSignTexture("VALETING", {
      width: 512,
      height: 384,
      bg: "#f6f5f0",
      fg: "#c8102e",
      font: "bold 74px Archivo, Arial, sans-serif",
    });
    const hours = makeSignTexture("MON–SAT", {
      width: 256,
      height: 192,
      bg: "#1c1f2a",
      fg: "#f1e6c8",
      font: "bold 44px Archivo, Arial, sans-serif",
    });
    return { wall, hedge, canopy, puddle: makePuddleTexture(42), aboard, hours };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);

  // Hedge segments: one long run broken into blocks of slightly different height, so it
  // reads as growth rather than a wall. Right boundary first, then behind the house.
  const hedges = useMemo(() => {
    const r = rng(91);
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    // Behind the wall that carries on from the railings to the right.
    for (let x = 17; x < 41; x += 2.4) {
      out.push({ pos: [x + 1.2, 0.9 + r() * 0.2, Z + 12.9], size: [2.6, 1.8 + r() * 0.4, 1.3] });
    }
    // And behind the one down the left flank, so it runs along z instead.
    for (let z = 3; z < 21; z += 2.4) {
      out.push({ pos: [-27.7, 0.95 + r() * 0.2, z + 1.2], size: [1.3, 1.9 + r() * 0.4, 2.6] });
    }
    return out;
  }, []);

  // Trees to the sides and behind, the same dark clusters as the pair by the church.
  const trees = useMemo(
    () =>
      (
        [
          [26, Z - 9, 1.15],
          [33, Z - 3, 0.9],
          [-21, Z - 6, 1.05],
          [-31, Z + 6, 0.8],
          [40, Z - 16, 1.3],
        ] as [number, number, number][]
      ).map(([x, z, s], i) => ({ x, z, s, key: i })),
    [],
  );

  return (
    <group>
      {/* ---- The hills behind the town: cones far enough out that the fog flattens
             them to a ridge, but near enough to sit under the horizon glow. ---- */}
      {HILLS.map(([x, z, r, h, sides], i) => (
        <mesh key={i} position={[x, -1.5, z]} rotation={[0, i * 1.1, 0]}>
          <coneGeometry args={[r, h, sides, 1]} />
          <meshBasicMaterial color="#141a26" />
        </mesh>
      ))}

      {/* ---- The apron: painted bays, worn lines, standing water. ---- */}
      {/* Three marked bays down the right of the yard, in front of the side building. */}
      {[3.4, 5.3, 7.2, 9.1].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, Z + 9.3]}>
          <planeGeometry args={[0.11, 5.0]} />
          <meshStandardMaterial color="#8f9298" roughness={0.9} transparent opacity={0.55} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.25, 0.012, Z + 6.75]}>
        <planeGeometry args={[5.8, 0.11]} />
        <meshStandardMaterial color="#8f9298" roughness={0.9} transparent opacity={0.55} />
      </mesh>
      {/* A hatched keep-clear in front of the door, faded to almost nothing. */}
      {[-3.2, -1.6, 0, 1.6, 3.2].map((o) => (
        <mesh key={o} rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[o, 0.011, Z + 2.2]}>
          <planeGeometry args={[0.09, 2.6]} />
          <meshStandardMaterial color="#b8ac82" roughness={0.9} transparent opacity={0.3} />
        </mesh>
      ))}

      {/* Standing water: smooth and dark, so the lamps and the lit door land in it. */}
      {PUDDLES.map(([x, z, r], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, i * 0.7]} position={[x, 0.016, z]}>
          <planeGeometry args={[r * 2.4, r * 2]} />
          <meshStandardMaterial
            alphaMap={tex.puddle}
            transparent
            opacity={0.6}
            depthWrite={false}
            color="#05070c"
            roughness={0.2}
            metalness={0.15}
            envMapIntensity={0.05}
          />
        </mesh>
      ))}

      {/* A gully and its grate along the foot of the front wall. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.013, Z + 0.55]}>
        <planeGeometry args={[26, 0.32]} />
        <meshStandardMaterial color="#2a2d33" roughness={0.7} />
      </mesh>
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, 0.02, Z + 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.34]} />
          <meshStandardMaterial color="#15181d" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}

      {/* ---- The working kit standing on the apron. ---- */}
      {/* The air line: a kerbed island with the pillar and its hose coiled on the drum.
          Set to the left of the second bay's mouth so it doesn't stand in the opening. */}
      <group position={[8.6, 0, Z + 10.6]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[2.6, 0.14, 1.1]} />
          <meshStandardMaterial color="#6a6c70" roughness={0.9} />
        </mesh>
        <mesh position={[-0.7, 0.75, 0]}>
          <boxGeometry args={[0.42, 1.3, 0.34]} />
          <meshStandardMaterial color="#c8102e" roughness={0.55} />
        </mesh>
        <mesh position={[-0.7, 1.44, 0]}>
          <boxGeometry args={[0.46, 0.1, 0.38]} />
          <meshStandardMaterial color="#2a2d33" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[-0.7, 1.18, 0.19]}>
          <planeGeometry args={[0.3, 0.2]} />
          <meshBasicMaterial color="#7fd6ff" toneMapped={false} />
        </mesh>
        {/* The jet wash beside it, its lance hung on the side. */}
        <mesh position={[0.7, 0.6, 0]}>
          <boxGeometry args={[0.6, 1.0, 0.5]} />
          <meshStandardMaterial color="#1d3f8a" roughness={0.5} />
        </mesh>
        <mesh position={[0.7, 1.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.05, 5, 12]} />
          <meshStandardMaterial color="#111318" roughness={0.85} />
        </mesh>
      </group>

      {/* Tyre stacks against the walls. */}
      {TYRES.map(([x, z, n, rot], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, rot, 0]}>
          {Array.from({ length: n }, (_, j) => (
            <mesh key={j} position={[0, 0.1 + j * 0.19, 0]} rotation={[Math.PI / 2, 0, j * 0.5]}>
              <torusGeometry args={[0.33, 0.115, 5, 14]} />
              <meshStandardMaterial color="#14151a" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Oil drums against the side building's right pier, clear of the bay mouth. */}
      {(
        [
          [19.7, 14.2, false],
          [20.3, 14.7, false],
          [19.6, 15.1, false],
          [21.0, 14.1, true],
        ] as [number, number, boolean][]
      ).map(([x, z, down], i) => (
        <mesh
          key={i}
          position={[x, down ? 0.3 : 0.44, z]}
          rotation={down ? [Math.PI / 2, 0, 0.4] : [0, i, 0]}
        >
          <cylinderGeometry args={[0.3, 0.3, 0.88, 12]} />
          <meshStandardMaterial color={i % 2 ? "#25406b" : "#4a2a20"} roughness={0.65} metalness={0.35} />
        </mesh>
      ))}

      {/* Wheelie bins along the house end of the yard. */}
      {(
        [
          [-6.4, 10.4, "#1f3d2b"],
          [-7.3, 10.5, "#2a2d33"],
          [-8.2, 10.4, "#3a3320"],
        ] as [number, number, string][]
      ).map(([x, z, c], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, 0.1 * i, 0]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.72, 1.05, 0.62]} />
            <meshStandardMaterial color={c} roughness={0.75} />
          </mesh>
          <mesh position={[0, 1.16, -0.04]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[0.76, 0.08, 0.68]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* A pallet of boxed stock waiting to go in, under a tarpaulin corner. */}
      <group position={[-5.6, 0, Z + 5.4]} rotation={[0, 0.22, 0]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[1.2, 0.14, 1.0]} />
          <meshStandardMaterial color="#6b5537" roughness={1} />
        </mesh>
        {(
          [
            [-0.26, 0.32, 0.02, 0.1],
            [0.28, 0.32, -0.04, -0.06],
            [0.02, 0.72, 0.06, 0.18],
          ] as [number, number, number, number][]
        ).map(([ox, oy, oz, rot], i) => (
          <mesh key={i} position={[ox, oy, oz]} rotation={[0, rot, 0]}>
            <boxGeometry args={[0.56, 0.36, 0.62]} />
            <meshStandardMaterial color={i === 2 ? "#8a6f47" : "#7d6440"} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0.02, 0.9, 0.06]} rotation={[0.1, 0.18, 0]}>
          <boxGeometry args={[0.7, 0.04, 0.74]} />
          <meshStandardMaterial color="#1f3d2b" roughness={0.85} />
        </mesh>
      </group>

      {/* Cones round the bay in use. */}
      {CONES.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.34, 0.06, 0.34]} />
            <meshStandardMaterial color="#c8410e" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <coneGeometry args={[0.14, 0.52, 8]} />
            <meshStandardMaterial color="#d4491a" roughness={0.75} />
          </mesh>
        </group>
      ))}

      {/* The A-board by the entrance, angled at whoever is coming in. */}
      <group position={[7.4, 0, FENCE_Z - 1.2]} rotation={[0, -0.5, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0.5, s * 0.15]} rotation={[s * 0.17, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.86, 1.0, 0.04]} />
              <meshStandardMaterial color="#1c1f2a" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, s * 0.03]}>
              <planeGeometry args={[0.74, 0.86]} />
              <meshStandardMaterial map={tex.aboard} roughness={0.7} side={DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ---- The front wall's own fabric, so it isn't a blank render panel. ---- */}
      {/* Downpipes off the eaves at both ends, each into its shoe. */}
      {[-6.35, 6.35].map((x) => (
        <group key={x} position={[x, 0, Z + 0.34]}>
          <mesh position={[0, (BAY.height + 0.2) / 2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, BAY.height + 0.2, 8]} />
            <meshStandardMaterial color="#23262c" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.14, 0.09]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.34, 8]} />
            <meshStandardMaterial color="#23262c" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* A personnel door in the right-hand panel, its own lamp over it. */}
      <group position={[5.5, 0, Z + 0.2]}>
        {/* Reveal first, then the leaf in front of it, then the ironmongery. */}
        <mesh position={[0, 1.05, 0.02]}>
          <planeGeometry args={[1.14, 2.22]} />
          <meshStandardMaterial color="#cdc8bc" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.02, 0.07]}>
          <boxGeometry args={[0.94, 2.04, 0.07]} />
          <meshStandardMaterial color="#1c3b2a" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.62, 0.12]}>
          <planeGeometry args={[0.56, 0.36]} />
          <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
        </mesh>
        <mesh position={[0.34, 1.0, 0.12]}>
          <boxGeometry args={[0.05, 0.18, 0.06]} />
          <meshStandardMaterial color="#b9bcc2" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* The opening-hours board, kept inboard so it sits on the render. */}
        <mesh position={[-0.9, 1.5, 0.06]}>
          <planeGeometry args={[0.56, 0.42]} />
          <meshStandardMaterial map={tex.hours} roughness={0.7} />
        </mesh>
      </group>

      {/* A steel window high in the left-hand panel, lit from inside. */}
      <group position={[-5.2, 2.35, Z + 0.2]}>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[1.7, 0.95]} />
          <meshBasicMaterial color="#f0c98a" toneMapped={false} />
        </mesh>
        {[-0.56, 0, 0.56].map((o) => (
          <mesh key={o} position={[o, 0, 0.05]}>
            <boxGeometry args={[0.05, 0.99, 0.03]} />
            <meshStandardMaterial color="#2a2d33" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[1.78, 0.05, 0.03]} />
          <meshStandardMaterial color="#2a2d33" roughness={0.7} />
        </mesh>
      </group>

      {/* A hose reel on its bracket, the standpipe and tap under it. */}
      <group position={[3.3, 0, Z + 0.2]}>
        <mesh position={[0, 1.45, 0.06]}>
          <boxGeometry args={[0.42, 0.42, 0.06]} />
          <meshStandardMaterial color="#2a2d33" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.45, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.16, 14]} />
          <meshStandardMaterial color="#1d3f8a" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.45, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.045, 5, 14]} />
          <meshStandardMaterial color="#111318" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.58, 0.1]}>
          <cylinderGeometry args={[0.035, 0.035, 1.16, 6]} />
          <meshStandardMaterial color="#8c8f95" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.42, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.2, 8]} />
          <meshStandardMaterial color="#7b6a4a" roughness={0.45} metalness={0.65} />
        </mesh>
      </group>
      {/* An extractor vent and a meter box on the left pier. */}
      <mesh position={[-3.4, 2.6, Z + 0.24]}>
        <cylinderGeometry args={[0.3, 0.3, 0.14, 12]} />
        <meshStandardMaterial color="#4b4f56" roughness={0.6} metalness={0.4} />
      </mesh>
      <group position={[-3.4, 1.1, Z + 0.26]}>
        <mesh>
          <boxGeometry args={[0.44, 0.56, 0.16]} />
          <meshStandardMaterial color="#cfcabd" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.085]}>
          <planeGeometry args={[0.36, 0.46]} />
          <meshStandardMaterial color="#a49f92" roughness={0.9} />
        </mesh>
        <mesh position={[0.15, 0, 0.095]}>
          <boxGeometry args={[0.04, 0.07, 0.03]} />
          <meshStandardMaterial color="#5c5f66" roughness={0.5} metalness={0.6} />
        </mesh>
      </group>

      {/* ---- The boundary the yard sits in. ---- */}
      {/* A stone wall carrying on from the railings to the right, with its coping. */}
      <group position={[26, 0, FENCE_Z]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[20, 1.1, 0.5]} />
          <meshStandardMaterial map={tex.wall} roughness={1} />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <boxGeometry args={[20.2, 0.12, 0.62]} />
          <meshStandardMaterial color="#6b6a63" roughness={0.95} />
        </mesh>
      </group>
      {/* And to the left, past the house. */}
      <group position={[-27, 0, Z + 5]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[16, 1.1, 0.5]} />
          <meshStandardMaterial map={tex.wall} roughness={1} />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <boxGeometry args={[16.2, 0.12, 0.62]} />
          <meshStandardMaterial color="#6b6a63" roughness={0.95} />
        </mesh>
      </group>

      {/* Hedge above and behind those walls. */}
      {hedges.map((h, i) => (
        <mesh key={i} position={h.pos} rotation={[0, i * 0.3, 0]}>
          <boxGeometry args={h.size} />
          <meshStandardMaterial map={tex.hedge} color="#7f9a6a" roughness={1} />
        </mesh>
      ))}

      {/* A lean-to store on the far side of the stone building: open front, tin roof. */}
      <group position={[25.5, 0, Z + 3]}>
        <mesh position={[0, 1.35, -2.4]}>
          <boxGeometry args={[7, 2.7, 0.3]} />
          <meshStandardMaterial map={tex.wall} roughness={1} />
        </mesh>
        {[-3.35, 3.35].map((x) => (
          <mesh key={x} position={[x, 1.25, 0]}>
            <boxGeometry args={[0.28, 2.5, 5]} />
            <meshStandardMaterial map={tex.wall} roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 2.85, 0]} rotation={[-0.14, 0, 0]}>
          <boxGeometry args={[7.6, 0.12, 5.6]} />
          <meshStandardMaterial color="#5c6168" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Timber stacked inside it. */}
        {[0, 1, 2].map((j) => (
          <mesh key={j} position={[-1.4, 0.22 + j * 0.34, -1.5]}>
            <boxGeometry args={[3.4, 0.3, 1.2]} />
            <meshStandardMaterial color="#6b5537" roughness={1} />
          </mesh>
        ))}
      </group>

      {/* Trees to fill the sides and break the sky. */}
      {trees.map(({ x, z, s, key }) => (
        <group key={key} position={[x, 0, z]} scale={s}>
          <mesh position={[0, 2.1, 0]}>
            <cylinderGeometry args={[0.2, 0.34, 4.2, 6]} />
            <meshStandardMaterial color="#2b241c" roughness={1} />
          </mesh>
          {(
            [
              [0, 5.4, 0, 3.0],
              [-1.7, 4.5, 0.7, 2.2],
              [1.6, 4.8, -0.7, 2.4],
              [0.3, 7.1, 0.4, 2.0],
            ] as [number, number, number, number][]
          ).map(([ox, oy, oz, r], j) => (
            <mesh key={j} position={[ox, oy, oz]}>
              <sphereGeometry args={[r, 8, 6]} />
              <meshStandardMaterial map={tex.canopy} color="#4c6b3f" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Bulkheads on the outbuildings, so the right of the yard has a wall behind it
          and not a black gap. */}
      {(
        [
          [11.0, Z + 6.6, 2.7],
          [19.5, Z + 6.6, 2.7],
          [25.5, Z - 1.6, 2.3],
        ] as [number, number, number][]
      ).map(([x, z, y], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <boxGeometry args={[0.26, 0.16, 0.18]} />
            <meshBasicMaterial color={LAMP_HEAD} toneMapped={false} />
          </mesh>
          <pointLight color={SODIUM} intensity={9} distance={12} decay={2} position={[0, -0.2, 0.5]} />
        </group>
      ))}

      {/* One tall lamp standard over the middle of the yard, as every forecourt has. */}
      <group position={[11.6, 0, FENCE_Z - 2.2]}>
        <mesh position={[0, 3.1, 0]}>
          <cylinderGeometry args={[0.07, 0.11, 6.2, 8]} />
          <meshStandardMaterial color="#2f3238" roughness={0.6} metalness={0.6} />
        </mesh>
        <mesh position={[-0.45, 6.15, 0]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[1.0, 0.09, 0.09]} />
          <meshStandardMaterial color="#2f3238" roughness={0.6} metalness={0.6} />
        </mesh>
        <mesh position={[-0.92, 6.02, 0]} rotation={[0, 0, 0.12]}>
          <boxGeometry args={[0.72, 0.16, 0.34]} />
          <meshBasicMaterial color={LAMP_HEAD} toneMapped={false} />
        </mesh>
        {mobile ? null : (
          <pointLight color={SODIUM} intensity={26} distance={22} decay={2} position={[-0.92, 5.8, 0]} />
        )}
      </group>
    </group>
  );
}
