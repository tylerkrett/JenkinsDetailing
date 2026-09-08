/**
 * The street: speed curve, scoring, the obstacle and can spawner, and the scenery that
 * scrolls past (lamps, shutters, murals, chalk, rooftops). Pure and seeded, so a run can be
 * replayed for tests and screenshots.
 */
import {
  CAN,
  OBSTACLES,
  type Can,
  type Obstacle,
  type ObstacleDef,
  type ObstacleKind,
} from "./entities";

export const SPEED = { min: 300, max: 675, rampScore: 2000 } as const;
/** Logical px of travel per point. */
export const PX_PER_POINT = 12;

/** Speed in logical px/s for a score, eased so the early game teaches before it tests. */
export function speedFor(score: number) {
  const t = Math.min(1, Math.max(0, score / SPEED.rampScore));
  const eased = 1 - (1 - t) * (1 - t);
  return SPEED.min + (SPEED.max - SPEED.min) * eased;
}

/** Deterministic mulberry32. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
  };
}
export type Rng = ReturnType<typeof createRng>;

export const NEIGHBOURHOODS = [
  "Shoreditch",
  "Brooklyn",
  "Peckham",
  "Bushwick",
  "Hackney Wick",
  "Williamsburg",
] as const;
export type Neighbourhood = (typeof NEIGHBOURHOODS)[number];
export const NEIGHBOURHOOD_EVERY = 500;

export function neighbourhoodFor(score: number): Neighbourhood {
  const i = Math.floor(Math.max(0, score) / NEIGHBOURHOOD_EVERY) % NEIGHBOURHOODS.length;
  return NEIGHBOURHOODS[i]!;
}

/** Rooftop vocabulary per neighbourhood; the silhouette layers draw from these. */
export type RoofStyle = "terrace" | "warehouse" | "tower" | "sawtooth";
export type RoofDeco = "chimneys" | "watertower" | "crane" | "aerial" | "gasholder" | "tank";
export const SKYLINE: Record<
  Neighbourhood,
  { styles: readonly RoofStyle[]; decos: readonly RoofDeco[]; heights: [number, number] }
> = {
  Shoreditch: { styles: ["terrace", "terrace", "warehouse"], decos: ["chimneys", "crane", "aerial"], heights: [70, 130] },
  Brooklyn: { styles: ["warehouse", "tower", "terrace"], decos: ["watertower", "watertower", "aerial"], heights: [80, 150] },
  Peckham: { styles: ["tower", "terrace", "terrace"], decos: ["aerial", "chimneys", "tank"], heights: [60, 170] },
  Bushwick: { styles: ["warehouse", "sawtooth", "warehouse"], decos: ["watertower", "tank", "aerial"], heights: [60, 110] },
  "Hackney Wick": { styles: ["sawtooth", "warehouse", "terrace"], decos: ["gasholder", "crane", "chimneys"], heights: [60, 120] },
  Williamsburg: { styles: ["tower", "warehouse", "tower"], decos: ["watertower", "aerial", "tank"], heights: [90, 180] },
};

export type Building = {
  x: number;
  w: number;
  h: number;
  style: RoofStyle;
  deco: RoofDeco | null;
  /** Window rhythm seed. */
  seed: number;
};
export type RoofLayer = { parallax: number; buildings: Building[]; nextX: number };

export type Chalk = { x: number; text: string };
export type Shutter = { x: number; w: number; seed: number };
export type Mural = { x: number; w: number };

export const LAMP_SPACING = 640;
export const MURAL_FIRST = 1400;
export const MURAL_SPACING = 3200;
export const MURAL_W = 260;
export const MURAL_PIECES = 8;

export type WorldState = {
  rng: Rng;
  /** Distance travelled in logical px. Screen x = worldX - distance. */
  distance: number;
  prevDistance: number;
  score: number;
  cans: number;
  obstacles: Obstacle[];
  pickups: Can[];
  nextObstacleX: number;
  nextId: number;
  neighbourhood: Neighbourhood;
  chalk: Chalk[];
  shutters: Shutter[];
  nextShutterX: number;
  far: RoofLayer;
  near: RoofLayer;
  /** Fixed star field, parallax 0.04, as [x, y, size] in a 2000 px wide loop. */
  stars: [number, number, number][];
};

export function createWorld(seed: number, viewW: number): WorldState {
  const rng = createRng(seed);
  const stars: [number, number, number][] = [];
  for (let i = 0; i < 70; i++) stars.push([rng.range(0, 2000), rng.range(0.02, 0.5), rng.range(0.6, 1.6)]);
  const w: WorldState = {
    rng,
    distance: 0,
    prevDistance: 0,
    score: 0,
    cans: 0,
    obstacles: [],
    pickups: [],
    // The first obstacle arrives after a breath, whatever the screen width.
    nextObstacleX: viewW + 420,
    nextId: 1,
    neighbourhood: NEIGHBOURHOODS[0],
    chalk: [{ x: viewW * 0.55, text: NEIGHBOURHOODS[0] }],
    shutters: [],
    nextShutterX: 380,
    far: { parallax: 0.16, buildings: [], nextX: -200 },
    near: { parallax: 0.34, buildings: [], nextX: -200 },
    stars,
  };
  fillRoofs(w, w.far, viewW, 1.0);
  fillRoofs(w, w.near, viewW, 0.72);
  return w;
}

/** Ahead of the camera by this many px is the spawn horizon. */
const HORIZON = 200;

/** Moves the world by dt at the given speed and spawns what has come into range. */
export function stepWorld(w: WorldState, dt: number, speed: number, viewW: number) {
  w.prevDistance = w.distance;
  w.distance += speed * dt;
  const distScore = Math.floor(w.distance / PX_PER_POINT);
  w.score = distScore + w.cans * CAN.points;

  const n = neighbourhoodFor(w.score);
  if (n !== w.neighbourhood) {
    w.neighbourhood = n;
    w.chalk.push({ x: w.distance + viewW + 60, text: n });
  }

  const edge = w.distance + viewW + HORIZON;
  while (w.nextObstacleX < edge) spawnObstacle(w, speed);
  while (w.nextShutterX < edge) {
    w.shutters.push({ x: w.nextShutterX, w: w.rng.int(90, 150), seed: w.rng.next() });
    w.nextShutterX += w.rng.int(420, 760);
  }
  fillRoofs(w, w.far, viewW, 1.0);
  fillRoofs(w, w.near, viewW, 0.72);

  // Cull what has left the screen.
  const gone = w.distance - 200;
  w.obstacles = w.obstacles.filter((o) => o.x + o.def.w > gone);
  w.pickups = w.pickups.filter((c) => !c.taken && c.x + CAN.w > gone);
  w.chalk = w.chalk.filter((c) => c.x + 400 > gone);
  w.shutters = w.shutters.filter((s) => s.x + s.w > gone);
  cullRoofs(w.far, w.distance);
  cullRoofs(w.near, w.distance);
}

/** Air time of a full jump, used to size gaps so every one is clearable. */
const FULL_JUMP_TIME = (2 * 726) / 2200;

function pickDef(w: WorldState): ObstacleDef {
  const pool = OBSTACLES.filter((d) => d.minScore <= w.score);
  const total = pool.reduce((s, d) => s + d.weight, 0);
  let r = w.rng.next() * total;
  for (const d of pool) {
    r -= d.weight;
    if (r <= 0) return d;
  }
  return pool[pool.length - 1]!;
}

function spawnObstacle(w: WorldState, speed: number) {
  const def = pickDef(w);
  const x = w.nextObstacleX;
  w.obstacles.push({ def, x, id: w.nextId++ });

  // Doubles from 600: a second, small piece one full jump later, so it reads as a rhythm.
  const canDouble = w.score >= 600 && def.lift === 0 && w.rng.next() < 0.28;
  let tailX = x + def.w;
  if (canDouble) {
    const small = w.rng.pick(OBSTACLES.filter((d) => d.lift === 0 && d.w <= 40 && d.minScore <= w.score));
    const dx = speed * (FULL_JUMP_TIME * 1.15) + def.w;
    w.obstacles.push({ def: small, x: x + dx, id: w.nextId++ });
    tailX = x + dx + small.w;
  }

  // Gap to the next obstacle: at least a jump and a landing, up to a stretch of clear road.
  const minGap = speed * (FULL_JUMP_TIME * 0.95) + 110;
  const gap = minGap + speed * w.rng.range(0.15, 0.95);
  const nextX = tailX + gap;
  spawnCans(w, def, x, tailX, nextX);
  w.nextObstacleX = nextX;
}

function spawnCans(w: WorldState, def: ObstacleDef, x: number, tailX: number, nextX: number) {
  const roll = w.rng.next();
  // One can floating over a small obstacle rewards the clean jump.
  if (def.lift === 0 && def.w <= 40 && def.h <= 46 && roll < 0.45) {
    w.pickups.push({ x: x + def.w / 2 - CAN.w / 2, y: def.h + 34, id: w.nextId++, taken: false });
    return;
  }
  const gap = nextX - tailX;
  if (gap < 240) return;
  const mid = tailX + gap / 2;
  if (roll < 0.75) {
    // An arc of three at jump height.
    for (let i = -1; i <= 1; i++) {
      w.pickups.push({ x: mid + i * 44 - CAN.w / 2, y: i === 0 ? 92 : 62, id: w.nextId++, taken: false });
    }
  } else if (roll < 0.92) {
    // Two on the pavement, no jump needed.
    for (let i = 0; i < 2; i++) {
      w.pickups.push({ x: mid - 30 + i * 46, y: 10, id: w.nextId++, taken: false });
    }
  }
}

function fillRoofs(w: WorldState, layer: RoofLayer, viewW: number, scale: number) {
  const camera = w.distance * layer.parallax;
  const edge = camera + viewW + 100;
  const sky = SKYLINE[w.neighbourhood];
  while (layer.nextX < edge) {
    const style = w.rng.pick(sky.styles);
    const bw = w.rng.int(70, 150) * (style === "tower" ? 0.8 : 1);
    const [lo, hi] = sky.heights;
    const h = w.rng.range(lo, hi) * scale * (style === "tower" ? 1.3 : 1);
    layer.buildings.push({
      x: layer.nextX,
      w: bw,
      h,
      style,
      deco: w.rng.next() < 0.45 ? w.rng.pick(sky.decos) : null,
      seed: w.rng.next(),
    });
    layer.nextX += bw + w.rng.int(-6, 22);
  }
}

function cullRoofs(layer: RoofLayer, distance: number) {
  const gone = distance * layer.parallax - 80;
  if (layer.buildings.length && layer.buildings[0]!.x + layer.buildings[0]!.w < gone) {
    layer.buildings = layer.buildings.filter((b) => b.x + b.w > gone);
  }
}

/** Murals live at fixed world positions; returns those overlapping the view. */
export function muralsInView(distance: number, viewW: number): Mural[] {
  const out: Mural[] = [];
  const first = Math.max(0, Math.floor((distance - MURAL_W - MURAL_FIRST) / MURAL_SPACING));
  for (let k = first; ; k++) {
    const x = MURAL_FIRST + k * MURAL_SPACING;
    if (x > distance + viewW) break;
    if (x + MURAL_W > distance) out.push({ x, w: MURAL_W });
  }
  return out;
}

/** Lamp posts likewise. */
export function lampsInView(distance: number, viewW: number): number[] {
  const out: number[] = [];
  const first = Math.floor((distance - 40) / LAMP_SPACING);
  for (let k = Math.max(0, first); ; k++) {
    const x = 300 + k * LAMP_SPACING;
    if (x > distance + viewW + 40) break;
    if (x > distance - 40) out.push(x);
  }
  return out;
}

export function muralPieces(cans: number) {
  return Math.min(MURAL_PIECES, Math.floor(cans / CAN.perPiece));
}

export type { ObstacleKind };
