/**
 * The run: speed curve, scoring, the obstacle and bottle spawner, and the frontage of Rose
 * Garage that scrolls past (cladding, roller doors, windows, the sign, the cottage and, on
 * a fixed grid, the lit bays with a car in). Pure and seeded, so a run can be replayed for
 * tests and screenshots. Scenery draws from its own random stream, so the obstacles a seed
 * produces never depend on the screen size.
 */
import { BOTTLE, OBSTACLES, type Bottle, type Obstacle, type ObstacleDef, type ObstacleKind } from "./entities";

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

/** The stretches of the night shift, named on screen every 500 points. */
export const STAGES = [
  "The forecourt",
  "Wash bay",
  "Under the lights",
  "The workshop",
  "Polishing lane",
  "The final rinse",
] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_EVERY = 500;

export function stageFor(score: number): Stage {
  const i = Math.floor(Math.max(0, score) / STAGE_EVERY) % STAGES.length;
  return STAGES[i]!;
}

/** Modules of the garage frontage. `wall` is plain cladding of any width; the rest are fixed. */
export type FacadeKind = "wall" | "door" | "window" | "sign" | "cottage";
export const FACADE_W = { door: 150, window: 110, sign: 220, cottage: 200 } as const;
export type Facade = { x: number; w: number; kind: FacadeKind; seed: number };

const FACADE_MIX: { kind: FacadeKind; weight: number }[] = [
  { kind: "wall", weight: 3 },
  { kind: "door", weight: 3 },
  { kind: "window", weight: 3 },
  { kind: "sign", weight: 1 },
  { kind: "cottage", weight: 1 },
];
const FACADE_WEIGHT = FACADE_MIX.reduce((s, f) => s + f.weight, 0);

export const LAMP_SPACING = 640;
/** The lit bays, each with a car the bottles polish, sit at fixed world positions. */
export const BAY_FIRST = 1400;
export const BAY_SPACING = 3200;
export const BAY_W = 260;
/** Panels per car; one is polished for every BOTTLE.perPanel bottles. */
export const PANELS = 8;

export type WorldState = {
  rng: Rng;
  /** Scenery's own stream. */
  scenery: Rng;
  /** Where this run started; the score counts from here. */
  origin: number;
  /** Distance travelled in logical px. Screen x = worldX - distance. */
  distance: number;
  prevDistance: number;
  score: number;
  bottles: number;
  obstacles: Obstacle[];
  pickups: Bottle[];
  nextObstacleX: number;
  nextId: number;
  stage: Stage;
  facade: Facade[];
  nextFacadeX: number;
  /** Fixed star field as [x in a 2000 px loop, height as a share of the sky, size, alpha]. */
  stars: [number, number, number, number][];
  /** Phases that shape the hills, so each visit gets its own skyline. */
  hills: [number, number, number];
};

/** Ahead of the camera by this many px is the spawn horizon. */
const HORIZON = 200;

export function createWorld(seed: number, viewW: number, origin = 0): WorldState {
  const rng = createRng(seed);
  const scenery = createRng(seed ^ 0x5bd1e995);
  const stars: WorldState["stars"] = [];
  for (let i = 0; i < 80; i++) {
    stars.push([scenery.range(0, 2000), scenery.range(0.03, 0.8), scenery.range(0.8, 1.8), scenery.range(0.25, 0.85)]);
  }
  const w: WorldState = {
    rng,
    scenery,
    origin,
    distance: origin,
    prevDistance: origin,
    score: 0,
    bottles: 0,
    obstacles: [],
    pickups: [],
    // The first obstacle arrives after a breath, whatever the screen width.
    nextObstacleX: origin + viewW + 420,
    nextId: 1,
    stage: STAGES[0],
    facade: [],
    nextFacadeX: origin - 260,
    stars,
    hills: [scenery.range(0, 100), scenery.range(0, 100), scenery.range(0, 100)],
  };
  fillFacade(w, origin + viewW + HORIZON);
  return w;
}

/** Starts a run where the scenery is now, so the frontage carries straight on. */
export function startRun(w: WorldState, viewW: number) {
  w.origin = w.distance;
  w.prevDistance = w.distance;
  w.score = 0;
  w.bottles = 0;
  w.obstacles.length = 0;
  w.pickups.length = 0;
  w.nextObstacleX = w.distance + viewW + 420;
  w.stage = STAGES[0];
}

/**
 * Moves the world by dt at the given speed. Obstacles and bottles only spawn, and the score
 * only counts, when `spawn` is on; the title screen just drifts past the frontage.
 */
export function stepWorld(w: WorldState, dt: number, speed: number, viewW: number, spawn = true) {
  w.prevDistance = w.distance;
  w.distance += speed * dt;
  const edge = w.distance + viewW + HORIZON;
  if (spawn) {
    w.score = Math.floor((w.distance - w.origin) / PX_PER_POINT) + w.bottles * BOTTLE.points;
    w.stage = stageFor(w.score);
    while (w.nextObstacleX < edge) spawnObstacle(w, speed);
  }
  fillFacade(w, edge);

  // Cull what has left the screen. Everything is appended in x order, so trim from the front
  // in place: no new arrays sixty times a second.
  const gone = w.distance - 200;
  while (w.obstacles.length && w.obstacles[0]!.x + w.obstacles[0]!.def.w < gone) w.obstacles.shift();
  while (w.pickups.length && w.pickups[0]!.x + BOTTLE.w < gone) w.pickups.shift();
  while (w.facade.length && w.facade[0]!.x + w.facade[0]!.w < gone - 100) w.facade.shift();
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
  spawnBottles(w, def, x, tailX, nextX);
  w.nextObstacleX = nextX;
}

function spawnBottles(w: WorldState, def: ObstacleDef, x: number, tailX: number, nextX: number) {
  const roll = w.rng.next();
  // One bottle floating over a small obstacle rewards the clean jump.
  if (def.lift === 0 && def.w <= 40 && def.h <= 46 && roll < 0.45) {
    w.pickups.push({ x: x + def.w / 2 - BOTTLE.w / 2, y: def.h + 34, id: w.nextId++, taken: false });
    return;
  }
  const gap = nextX - tailX;
  if (gap < 240) return;
  const mid = tailX + gap / 2;
  if (roll < 0.75) {
    // An arc of three at jump height.
    for (let i = -1; i <= 1; i++) {
      w.pickups.push({ x: mid + i * 44 - BOTTLE.w / 2, y: i === 0 ? 92 : 62, id: w.nextId++, taken: false });
    }
  } else if (roll < 0.92) {
    // Two on the forecourt, no jump needed.
    for (let i = 0; i < 2; i++) {
      w.pickups.push({ x: mid - 30 + i * 46, y: 10, id: w.nextId++, taken: false });
    }
  }
}

/* ---------- the frontage ---------- */

/** The bay whose span contains x, or null. */
function bayAt(x: number) {
  if (x < BAY_FIRST) return null;
  const start = BAY_FIRST + Math.floor((x - BAY_FIRST) / BAY_SPACING) * BAY_SPACING;
  return x < start + BAY_W ? start : null;
}

/** The first bay that starts at or after x. */
function nextBayFrom(x: number) {
  return BAY_FIRST + Math.max(0, Math.ceil((x - BAY_FIRST) / BAY_SPACING)) * BAY_SPACING;
}

function pickFacade(w: WorldState): FacadeKind {
  const last = w.facade[w.facade.length - 1]?.kind;
  for (let tries = 0; tries < 4; tries++) {
    let r = w.scenery.next() * FACADE_WEIGHT;
    for (const f of FACADE_MIX) {
      r -= f.weight;
      if (r > 0) continue;
      // Plain wall may repeat; a feature never sits beside another of its kind.
      if (f.kind === "wall" || f.kind !== last) return f.kind;
      break;
    }
  }
  return "wall";
}

function fillFacade(w: WorldState, edge: number) {
  while (w.nextFacadeX < edge) {
    const x = w.nextFacadeX;
    const inBay = bayAt(x);
    if (inBay !== null) {
      w.nextFacadeX = inBay + BAY_W;
      continue;
    }
    const kind = pickFacade(w);
    const width = kind === "wall" ? w.scenery.int(70, 190) : FACADE_W[kind];
    const bay = nextBayFrom(x);
    if (x + width > bay) {
      // Plain wall up to the bay, then carry on after it.
      w.facade.push({ x, w: bay - x, kind: "wall", seed: w.scenery.next() });
      w.nextFacadeX = bay + BAY_W;
      continue;
    }
    w.facade.push({ x, w: width, kind, seed: w.scenery.next() });
    w.nextFacadeX = x + width;
  }
}

/** World x of the bays overlapping the view, written into `out` (reused every frame). */
export function baysInView(distance: number, viewW: number, out: number[] = []): number[] {
  out.length = 0;
  const first = Math.max(0, Math.floor((distance - BAY_W - BAY_FIRST) / BAY_SPACING));
  for (let k = first; ; k++) {
    const x = BAY_FIRST + k * BAY_SPACING;
    if (x > distance + viewW) break;
    if (x + BAY_W > distance) out.push(x);
  }
  return out;
}

/** World x of the street lamps in view, likewise. */
export function lampsInView(distance: number, viewW: number, out: number[] = []): number[] {
  out.length = 0;
  const first = Math.floor((distance - 120) / LAMP_SPACING);
  for (let k = Math.max(0, first); ; k++) {
    const x = 300 + k * LAMP_SPACING;
    if (x > distance + viewW + 120) break;
    if (x > distance - 120) out.push(x);
  }
  return out;
}

/** Car panels polished by this many bottles. */
export function panelsFor(bottles: number) {
  return Math.min(PANELS, Math.floor(bottles / BOTTLE.perPanel));
}

export type { ObstacleKind };
