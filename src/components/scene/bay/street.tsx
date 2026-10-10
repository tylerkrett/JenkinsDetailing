"use client";

import { useEffect, useMemo } from "react";
import { Color, type Texture } from "three";

import { BAY } from "~/lib/scene/bay-layout";
import { type ShopSpec, makePavingTexture, makeRoadTexture, makeShopfrontTextures, makeStoneTexture } from "~/lib/scene/bay-textures";

/** Half the carriageway, and the pavement either side of it, in metres. */
export const ROAD_HALF = 4.5;
export const PAVEMENT = 3.0;
/** The street runs from the forecourt railings out to here. */
export const STREET_FROM = BAY.shutterZ + 12;
export const STREET_TO = 92;

const SODIUM = new Color("#ffb45c");
const LAMP_HEAD = new Color(1.5, 1.1, 0.62);

type Building = ShopSpec & { height: number; awning?: boolean; postbox?: boolean };

/** The shops down the left of the street, garage end first. */
const LEFT: Building[] = [
  { name: "Becws Teifi", sub: "bakery · bara ffres", width: 5.6, height: 7.2, wall: "#e7dfd0", frame: "#1f3d2b", letter: "#f1e6c8", lit: [true, false], open: true, seed: 11, awning: true },
  { name: "Siop Sglodion", sub: "fish & chips", width: 5.0, height: 6.7, wall: "#c7d3dc", frame: "#141518", letter: "#e8c46a", lit: [false, true], open: true, seed: 12 },
  { name: "Fferyllfa", sub: "pharmacy", width: 6.4, height: 7.6, wall: "stone", frame: "#1c2a4a", letter: "#f1e6c8", lit: [true, true, false], open: false, seed: 13 },
  { name: "Y Llew Coch", sub: "tafarn · free house", width: 7.0, height: 7.9, wall: "#d9c6bf", frame: "#5a1d24", letter: "#e8c46a", lit: [true, true, true], open: true, seed: 14 },
  { name: "Llyfrau'r Bont", sub: "books · maps", width: 5.2, height: 7.0, wall: "#b7c4b1", frame: "#2f4f6a", letter: "#f1e6c8", lit: [false, false], open: true, seed: 15, awning: true },
  { name: "Cigydd", sub: "family butcher", width: 5.4, height: 7.2, wall: "#e4d8c0", frame: "#4a2c17", letter: "#f1e6c8", lit: [true, false], open: false, seed: 16 },
  { name: "Caffi'r Sgwar", sub: "coffee · cacen", width: 6.0, height: 7.4, wall: "stone", frame: "#1f3d2b", letter: "#e8c46a", lit: [false, true, true], open: true, seed: 17 },
  { name: "Swyddfa'r Post", sub: "post office", width: 5.8, height: 6.9, wall: "#d8cfc4", frame: "#c8102e", letter: "#f1e6c8", lit: [true, false, false], open: false, seed: 18, postbox: true },
  { name: "Gwlân a Mwy", sub: "wool · haberdashery", width: 5.0, height: 7.1, wall: "#c9b8a8", frame: "#2f4f6a", letter: "#f1e6c8", lit: [true, true], open: true, seed: 19 },
  { name: "Tŷ Ifan", sub: "guest house", width: 6.2, height: 7.7, wall: "#e7dfd0", frame: "#141518", letter: "#e8c46a", lit: [true, false, true], open: false, seed: 20 },
];

/** And down the right. */
const RIGHT: Building[] = [
  { name: "Siop y Pentre", sub: "general store · papurau", width: 6.2, height: 7.3, wall: "#d8cfc4", frame: "#1c2a4a", letter: "#f1e6c8", lit: [true, false, true], open: true, seed: 21, awning: true },
  { name: "Barbwr", sub: "gents' barber", width: 4.8, height: 6.8, wall: "#e6d2d2", frame: "#141518", letter: "#e8c46a", lit: [false, true], open: true, seed: 22 },
  { name: "Banc y Dref", sub: "est. 1889", width: 7.2, height: 8.2, wall: "stone", frame: "#1f3d2b", letter: "#e8c46a", lit: [false, false, false], open: false, seed: 23 },
  { name: "Tŷ Te", sub: "tea rooms", width: 5.4, height: 7.0, wall: "#c7d3dc", frame: "#5a1d24", letter: "#f1e6c8", lit: [true, true], open: true, seed: 24, awning: true },
  { name: "Anrhegion", sub: "gifts · cards", width: 5.0, height: 6.9, wall: "#e4d8c0", frame: "#2f4f6a", letter: "#f1e6c8", lit: [true, false], open: true, seed: 25 },
  { name: "Eryr Aur", sub: "hotel · bar", width: 7.4, height: 8.0, wall: "#e7dfd0", frame: "#141518", letter: "#e8c46a", lit: [true, true, true], open: true, seed: 26 },
  { name: "Gwerthwr Tai", sub: "estate agent", width: 5.2, height: 7.1, wall: "#b7c4b1", frame: "#1c2a4a", letter: "#f1e6c8", lit: [false, true], open: false, seed: 27 },
  { name: "Ffrwythau", sub: "greengrocer", width: 5.6, height: 7.2, wall: "stone", frame: "#1f3d2b", letter: "#f1e6c8", lit: [true, false], open: true, seed: 28, awning: true },
  { name: "Crydd", sub: "shoe repairs · keys", width: 4.8, height: 6.7, wall: "#d9c6bf", frame: "#4a2c17", letter: "#e8c46a", lit: [false, false], open: false, seed: 29 },
  { name: "Siop Trin Gwallt", sub: "hair · beauty", width: 5.8, height: 7.4, wall: "#c9b8a8", frame: "#5a1d24", letter: "#f1e6c8", lit: [true, true, false], open: true, seed: 30 },
];

/** Lamps down both pavements, staggered; the first few carry a real light. */
const LAMPS: [number, number][] = [
  [-1, 26],
  [1, 33],
  [-1, 41],
  [1, 48],
  [-1, 56],
  [1, 63],
  [-1, 71],
  [1, 78],
];

type Props = { mobile: boolean };

/**
 * The high street beyond the forecourt: a black wet road with its markings, kerbs and
 * paved pavements, a terrace of painted and stone shops down each side with their
 * windows lit, sodium lamps, a post box and bins. Everything is a box, a plane and a
 * canvas texture; no files.
 */
export function Street({ mobile }: Props) {
  const tex = useMemo(() => {
    const road = makeRoadTexture();
    road.repeat.set(1, (STREET_TO - STREET_FROM) / 6);
    const paving = makePavingTexture();
    paving.repeat.set(PAVEMENT / 2.4, (STREET_TO - STREET_FROM) / 2.4);
    const stone = makeStoneTexture(31);
    stone.repeat.set(2, 1.5);
    return { road, paving, stone };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);

  // Lay each side out along z from the railings, and draw its facades.
  const rows = useMemo(() => {
    const lay = (list: Building[], side: 1 | -1) => {
      let z = STREET_FROM + 2;
      const out: { b: Building; z: number; side: 1 | -1; map: Texture; glow: Texture }[] = [];
      for (const b of list) {
        if (mobile && z > 62) break;
        const { map, glow } = makeShopfrontTextures(b);
        out.push({ b, z: z + b.width / 2, side, map, glow });
        z += b.width;
      }
      return out;
    };
    return [...lay(LEFT, -1), ...lay(RIGHT, 1)];
  }, [mobile]);
  useEffect(
    () => () => {
      for (const r of rows) {
        r.map.dispose();
        r.glow.dispose();
      }
    },
    [rows],
  );

  const length = STREET_TO - STREET_FROM;
  const midZ = (STREET_FROM + STREET_TO) / 2;
  const facadeX = ROAD_HALF + PAVEMENT;
  // Every real light is paid for on every lit pixel of the scene, inside the bay too, so
  // only the nearest lamps carry one; the rest glow on their own.
  const litLamps = mobile ? 1 : 2;

  return (
    <group>
      {/* The ground under everything, so nothing shows through behind the shops. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 40]}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#0a0b0e" roughness={1} />
      </mesh>

      {/* The carriageway. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[ROAD_HALF * 2, length]} />
        <meshStandardMaterial map={tex.road} roughness={0.5} metalness={0.05} envMapIntensity={0.2} />
      </mesh>
      {/* Kerbs and pavements either side. */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh position={[sx * (ROAD_HALF + 0.15), 0.06, midZ]}>
            <boxGeometry args={[0.3, 0.12, length]} />
            <meshStandardMaterial color="#5f6166" roughness={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sx * (ROAD_HALF + 0.3 + PAVEMENT / 2), 0.12, midZ]}>
            <planeGeometry args={[PAVEMENT, length]} />
            <meshStandardMaterial map={tex.paving} roughness={0.9} envMapIntensity={0.3} />
          </mesh>
        </group>
      ))}

      {/* The shops. */}
      {rows.map(({ b, z, side, map, glow }) => {
        const h = b.height;
        const depth = 9;
        const bodyX = side * (facadeX + depth / 2);
        const wall = b.wall === "stone" ? undefined : b.wall;
        // The front roof slope, from the eaves up to a ridge 4 m back.
        const pitch = 0.62;
        const slope = 4.6;
        return (
          <group key={`${side}${z}`}>
            <mesh position={[bodyX, h / 2, z]}>
              <boxGeometry args={[depth, h, b.width]} />
              <meshStandardMaterial map={b.wall === "stone" ? tex.stone : undefined} color={wall ?? "#ffffff"} roughness={1} />
            </mesh>
            <mesh position={[side * (facadeX - 0.01), h / 2, z]} rotation={[0, -side * Math.PI / 2, 0]}>
              <planeGeometry args={[b.width, h]} />
              <meshStandardMaterial map={map} emissiveMap={glow} emissive="#ffffff" emissiveIntensity={1.15} roughness={0.85} />
            </mesh>
            {/* Slate roof, ridge and a chimney. */}
            <mesh
              position={[side * (facadeX + (Math.cos(pitch) * slope) / 2 - 0.1), h + (Math.sin(pitch) * slope) / 2, z]}
              rotation={[0, 0, side * pitch]}
            >
              <boxGeometry args={[slope, 0.14, b.width + 0.1]} />
              <meshStandardMaterial color="#23272e" roughness={0.75} metalness={0.05} />
            </mesh>
            <mesh position={[side * (facadeX + Math.cos(pitch) * slope - 0.1), h + Math.sin(pitch) * slope, z]}>
              <boxGeometry args={[0.3, 0.16, b.width + 0.1]} />
              <meshStandardMaterial color="#2c3038" roughness={0.8} />
            </mesh>
            <mesh position={[side * (facadeX + Math.cos(pitch) * slope - 0.3), h + Math.sin(pitch) * slope + 0.6, z - b.width * 0.3]}>
              <boxGeometry args={[0.75, 1.5, 0.85]} />
              <meshStandardMaterial map={tex.stone} color="#b8a99a" roughness={1} />
            </mesh>
            {/* Gutter along the eaves. */}
            <mesh position={[side * (facadeX + 0.08), h - 0.1, z]}>
              <boxGeometry args={[0.16, 0.14, b.width]} />
              <meshStandardMaterial color="#1e2126" roughness={0.6} metalness={0.3} />
            </mesh>
            {/* An awning over the window on some. */}
            {b.awning ? (
              <mesh position={[side * (facadeX - 0.55), 2.5, z - 0.35]} rotation={[0, 0, side * 0.42]}>
                <boxGeometry args={[1.2, 0.05, b.width - 2.2]} />
                <meshStandardMaterial color={b.frame} roughness={0.9} />
              </mesh>
            ) : null}
            {/* The post box outside the post office. */}
            {b.postbox ? (
              <group position={[side * (ROAD_HALF + 0.9), 0.12, z + b.width / 2 - 0.6]}>
                <mesh position={[0, 0.75, 0]}>
                  <cylinderGeometry args={[0.26, 0.26, 1.5, 14]} />
                  <meshStandardMaterial color="#c8102e" roughness={0.5} />
                </mesh>
                <mesh position={[0, 1.55, 0]}>
                  <cylinderGeometry args={[0.3, 0.3, 0.1, 14]} />
                  <meshStandardMaterial color="#111" roughness={0.6} />
                </mesh>
              </group>
            ) : null}
          </group>
        );
      })}

      {/* Street lamps, staggered down both pavements. */}
      {LAMPS.map(([side, z], i) => {
        if (mobile && z > 62) return null;
        return (
          <group key={i} position={[side * (ROAD_HALF + 0.9), 0.12, z]}>
            <mesh position={[0, 2.8, 0]}>
              <cylinderGeometry args={[0.055, 0.09, 5.6, 8]} />
              <meshStandardMaterial color="#2f3238" roughness={0.6} metalness={0.6} />
            </mesh>
            <mesh position={[-side * 0.5, 5.65, 0]}>
              <boxGeometry args={[1.1, 0.07, 0.07]} />
              <meshStandardMaterial color="#2f3238" roughness={0.6} metalness={0.6} />
            </mesh>
            <mesh position={[-side * 1.0, 5.55, 0]}>
              <boxGeometry args={[0.6, 0.18, 0.28]} />
              <meshBasicMaterial color={LAMP_HEAD} toneMapped={false} />
            </mesh>
            {i < litLamps ? <pointLight color={SODIUM} intensity={30} distance={24} decay={2} position={[-side * 1.0, 5.3, 0]} /> : null}
            {/* A litter bin by the foot of every other lamp. */}
            {i % 2 === 0 ? (
              <mesh position={[side * 0.9, 0.5, 1.2]}>
                <cylinderGeometry args={[0.24, 0.22, 1.0, 10]} />
                <meshStandardMaterial color="#1f3d2b" roughness={0.7} />
              </mesh>
            ) : null}
          </group>
        );
      })}

      {/* Bollards across the end of the pavements at the forecourt. */}
      {[-1, 1].flatMap((sx) =>
        [0.8, 1.9].map((o) => (
          <mesh key={`${sx}${o}`} position={[sx * (ROAD_HALF + o), 0.5, STREET_FROM + 0.6]}>
            <cylinderGeometry args={[0.08, 0.1, 0.9, 8]} />
            <meshStandardMaterial color="#1a1c22" roughness={0.6} metalness={0.4} />
          </mesh>
        )),
      )}
    </group>
  );
}
