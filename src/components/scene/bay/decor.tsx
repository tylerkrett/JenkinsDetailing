"use client";

import { useEffect, useMemo } from "react";
import type { Texture } from "three";

import { BAY } from "~/lib/scene/bay-layout";
import {
  ENAMELS,
  makeAutoglymTexture,
  makeBadgeChartTexture,
  makeBadgeStripTexture,
  makeClockTexture,
  makeEnamelSignTexture,
  makeGaragePosterTexture,
  makeMeguiarsTexture,
  makeNoticeboardTexture,
} from "~/lib/scene/bay-decor-textures";

/**
 * What is on the walls of the bay. Kept apart from `bay.tsx`, which owns the shell and
 * the lighting: this file only hangs things on surfaces the shell has already built.
 *
 * Placement follows the camera, not the room. Every act but the reveal sits on the near
 * left of the car looking forward, which puts the right wall across the frame; the
 * reveal swings over to the right of the car and looks at the left wall; and the back
 * wall is in front of the camera the whole way in and never behind it, so it gets almost
 * nothing. The car's roofline covers the walls below about 1.6m, so the pieces hang high.
 */

/** Inner faces of the shell. The wall boxes are 0.2 thick and centred on the extent. */
const RIGHT_X = BAY.halfW - 0.11;
const LEFT_X = -BAY.halfW + 0.11;
const BACK_Z = -BAY.length / 2 + 0.11;
const FRONT_Z = BAY.shutterZ - 0.16;

type Wall = "back" | "left" | "right" | "front";

/**
 * Where a wall sits and which way it faces, so a piece only gives its position along it.
 * `out` is always toward the middle of the bay — each wall's inward direction differs,
 * and getting one of them backwards buries the piece in the blockwork.
 */
function place(
  wall: Wall,
  a: number,
  y: number,
  out: number,
): { position: [number, number, number]; rotation: [number, number, number] } {
  switch (wall) {
    case "back":
      return { position: [a, y, BACK_Z + out], rotation: [0, 0, 0] };
    case "front":
      return { position: [a, y, FRONT_Z - out], rotation: [0, Math.PI, 0] };
    case "left":
      return { position: [LEFT_X + out, y, a], rotation: [0, Math.PI / 2, 0] };
    case "right":
      return {
        position: [RIGHT_X - out, y, a],
        rotation: [0, -Math.PI / 2, 0],
      };
  }
}

type ArtProps = {
  wall: Wall;
  /** Along the wall: x on the back and front walls, z on the sides. */
  at: number;
  y: number;
  w: number;
  h: number;
  map: Texture;
  /** A moulding round the art, in metres; 0 hangs it unframed. */
  frame?: number;
  frameColour?: string;
  roughness?: number;
  metalness?: number;
  /** Cut the texture's transparent ground away rather than blending it. */
  cutout?: boolean;
};

/** One piece on a wall: the art, and the moulding and backing board behind it if framed. */
function Art({
  wall,
  at,
  y,
  w,
  h,
  map,
  frame = 0,
  frameColour = "#2a211a",
  roughness = 0.8,
  metalness = 0,
  cutout = false,
}: ArtProps) {
  // The moulding is 0.05 deep and sits against the wall; the art is proud of its face.
  const { position, rotation } = place(wall, at, y, frame ? 0.053 : 0.022);
  const back = place(wall, at, y, 0.025);
  return (
    <group>
      {frame ? (
        <mesh position={back.position} rotation={back.rotation} castShadow>
          <boxGeometry args={[w + frame * 2, h + frame * 2, 0.05]} />
          <meshStandardMaterial
            color={frameColour}
            roughness={0.55}
            metalness={0.15}
          />
        </mesh>
      ) : null}
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={map}
          roughness={roughness}
          metalness={metalness}
          transparent={cutout}
          alphaTest={cutout ? 0.35 : 0}
        />
      </mesh>
    </group>
  );
}

/** A hose reel on its bracket: the drum on its side, the coil round it and the lance. */
function HoseReel({ wall, at, y }: { wall: Wall; at: number; y: number }) {
  const { position, rotation } = place(wall, at, y, 0.36);
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.3]} castShadow>
        <boxGeometry args={[0.1, 0.46, 0.12]} />
        <meshStandardMaterial color="#3a3f46" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* The drum lies on its side against the wall, so its axis runs along the bracket. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.28, 20]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} metalness={0.2} />
      </mesh>
      {[0.2, 0.26, 0.32].map((r, i) => (
        <mesh key={r} castShadow>
          <torusGeometry args={[r, 0.03, 8, 30]} />
          <meshStandardMaterial
            color={i % 2 ? "#15181c" : "#20242a"}
            roughness={0.9}
          />
        </mesh>
      ))}
      <mesh position={[0, -0.44, 0.08]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.44, 8]} />
        <meshStandardMaterial color="#8d939a" roughness={0.4} metalness={0.7} />
      </mesh>
    </group>
  );
}

/** A dry powder extinguisher on its wall bracket. */
function Extinguisher({ wall, at, y }: { wall: Wall; at: number; y: number }) {
  const { position, rotation } = place(wall, at, y, 0.17);
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.5, 18]} />
        <meshStandardMaterial
          color="#b8231f"
          roughness={0.35}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.101, 0.101, 0.14, 18]} />
        <meshStandardMaterial color="#f0ece2" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.032, 0.05, 0.14, 12]} />
        <meshStandardMaterial color="#2b2f35" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.36, 0.06]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.1, 0.02, 0.12]} />
        <meshStandardMaterial color="#3d434a" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, -0.02, -0.12]}>
        <boxGeometry args={[0.16, 0.3, 0.03]} />
        <meshStandardMaterial color="#c0392b" roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
}

/** Part-worns stacked against the wall, because every unit has a stack of them. */
function TyreStack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[(i % 2) * 0.02 - 0.01, 0.11 + i * 0.21, 0]}
          rotation={[Math.PI / 2, 0, i * 0.4]}
          castShadow
          receiveShadow
        >
          <torusGeometry args={[0.31, 0.105, 10, 26]} />
          <meshStandardMaterial color="#16171a" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** The bench at the back: a steel frame, a scarred top, a vice and a few tins left out. */
function Workbench({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.07, 0.62]} />
        <meshStandardMaterial color="#6b5843" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[2.2, 0.03, 0.56]} />
        <meshStandardMaterial color="#2b2f35" roughness={0.6} metalness={0.5} />
      </mesh>
      {[-1.05, 1.05].map((sx) => (
        <mesh key={sx} position={[sx, 0.44, 0]} castShadow>
          <boxGeometry args={[0.07, 0.88, 0.56]} />
          <meshStandardMaterial
            color="#2b2f35"
            roughness={0.6}
            metalness={0.5}
          />
        </mesh>
      ))}
      <mesh position={[-0.92, 1.02, 0.06]} castShadow>
        <boxGeometry args={[0.18, 0.18, 0.22]} />
        <meshStandardMaterial color="#1f3f6b" roughness={0.5} metalness={0.6} />
      </mesh>
      {[
        [0.36, "#c0392b"],
        [0.62, "#e0a92b"],
        [0.86, "#2f6f4f"],
      ].map(([dx, colour], i) => (
        <mesh key={i} position={[Number(dx), 1.0, -0.04]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.16, 14]} />
          <meshStandardMaterial
            color={String(colour)}
            roughness={0.4}
            metalness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

type Props = { mobile: boolean };

/** Everything hung on the bay walls, plus the few things standing against them. */
export function Decor({ mobile }: Props) {
  const tex = useMemo(() => {
    const [spirit, tyres, lube, service, polish] = ENAMELS;
    return {
      chart: makeBadgeChartTexture(),
      autoglym: makeAutoglymTexture(),
      meguiars: makeMeguiarsTexture(),
      clock: makeClockTexture(),
      notices: makeNoticeboardTexture(),
      poster: makeGaragePosterTexture(),
      stripA: makeBadgeStripTexture(5, 91),
      stripB: makeBadgeStripTexture(4, 137),
      spirit: makeEnamelSignTexture(spirit!, 81),
      tyres: makeEnamelSignTexture(tyres!, 82),
      lube: makeEnamelSignTexture(lube!, 83),
      service: makeEnamelSignTexture(service!, 84),
      polish: makeEnamelSignTexture(polish!, 85),
    };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);

  return (
    <group>
      {/* The right wall carries the collection: it is across the frame for five of the
          seven acts, so the chart and the two product boards hang where they are read. */}
      <Art
        wall="right"
        at={-1.3}
        y={2.95}
        w={0.86}
        h={0.86}
        map={tex.tyres}
        cutout
        roughness={0.28}
        metalness={0.12}
      />
      <Art
        wall="right"
        at={0.45}
        y={2.15}
        w={1.9}
        h={1.33}
        map={tex.chart}
        frame={0.06}
        roughness={0.92}
      />
      {/* The near lift post crosses this wall somewhere between z 1.5 and 3 from every
          act's camera, so the trade boards sit past it rather than behind it. */}
      <Art
        wall="right"
        at={3.55}
        y={2.58}
        w={0.64}
        h={0.64}
        map={tex.autoglym}
        frame={0.026}
        frameColour="#a8adb4"
        roughness={0.34}
        metalness={0.1}
      />
      <Art
        wall="right"
        at={3.55}
        y={1.84}
        w={1.0}
        h={0.562}
        map={tex.meguiars}
        frame={0.026}
        frameColour="#15161a"
        roughness={0.36}
        metalness={0.12}
      />
      <Art
        wall="right"
        at={5.25}
        y={3.06}
        w={1.8}
        h={0.36}
        map={tex.stripA}
        cutout
        roughness={0.24}
        metalness={0.16}
      />
      <Art
        wall="right"
        at={5.15}
        y={2.32}
        w={0.9}
        h={0.9}
        map={tex.spirit}
        cutout
        roughness={0.26}
        metalness={0.14}
      />
      <Art
        wall="right"
        at={6.3}
        y={2.42}
        w={0.5}
        h={0.5}
        map={tex.clock}
        cutout
        roughness={0.3}
        metalness={0.1}
      />
      {/* The reel goes in the post's shadow: a lump of geometry does not need reading
          the way a sign does, and it fills the gap the boards had to leave. */}
      <HoseReel wall="right" at={2.3} y={2.3} />
      <Extinguisher wall="right" at={6.4} y={1.12} />

      {/* The left wall above the shelving: what the reveal swings round to, and what the
          doorway frames while the car is still out on the forecourt. */}
      <Art
        wall="left"
        at={-3.6}
        y={2.88}
        w={2.1}
        h={0.525}
        map={tex.stripB}
        cutout
        roughness={0.24}
        metalness={0.16}
      />
      <Art
        wall="left"
        at={0.4}
        y={2.86}
        w={0.72}
        h={0.72}
        map={tex.lube}
        cutout
        roughness={0.26}
        metalness={0.14}
      />
      {/* The shelving's end panels stand 0.4m off this wall, and the reveal looks along
          it at a shallow angle — anything under about z 2.9 is behind one of them. */}
      <Art
        wall="left"
        at={3.5}
        y={1.95}
        w={0.85}
        h={1.196}
        map={tex.poster}
        frame={0.045}
        roughness={0.92}
      />
      <Art
        wall="left"
        at={5.0}
        y={2.2}
        w={1.1}
        h={0.733}
        map={tex.notices}
        frame={0.04}
        roughness={0.9}
      />
      <Art
        wall="left"
        at={6.25}
        y={2.55}
        w={0.75}
        h={0.75}
        map={tex.service}
        cutout
        roughness={0.26}
        metalness={0.14}
      />
      {!mobile ? <TyreStack x={-4.75} z={4.4} /> : null}

      {/* The back wall: the bench, and one sign for whatever catches it on the way in. */}
      <Workbench x={-1.4} z={BACK_Z + 0.42} />
      <Art
        wall="back"
        at={-1.4}
        y={2.35}
        w={0.82}
        h={0.82}
        map={tex.polish}
        cutout
        roughness={0.26}
        metalness={0.14}
      />

      {/* Either side of the door, so the wall reads as a garage on the way out too. */}
      <Art
        wall="front"
        at={-4.25}
        y={2.45}
        w={0.78}
        h={0.78}
        map={tex.spirit}
        cutout
        roughness={0.26}
        metalness={0.14}
      />
      <Art
        wall="front"
        at={4.25}
        y={2.45}
        w={0.72}
        h={0.72}
        map={tex.lube}
        cutout
        roughness={0.26}
        metalness={0.14}
      />
    </group>
  );
}
