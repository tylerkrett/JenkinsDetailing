/**
 * Player physics and the obstacle and bottle catalogue. Pure: no DOM, no canvas, so it can
 * be unit tested with node --test. All sizes are logical pixels; `y` is measured UP from
 * the ground line for everything that stands on the forecourt.
 */

export type Box = { x: number; y: number; w: number; h: number };

export const PLAYER = {
  w: 35,
  h: 56,
  duckH: 32,
  gravity: 2200,
  /** sqrt(2 * gravity * 120): a full hold clears 120 px. */
  jumpV: 726,
  /** Releasing early scales the rising speed by this: a tap clears about 65 px. */
  shortHop: 0.45,
  /** Holding down in the air multiplies gravity, so a duck input also drops you fast. */
  fastFall: 2.4,
  /** Head start on the ground: a jump pressed this long before landing still fires. */
  buffer: 0.09,
  hitInset: 0.18,
} as const;

export type PlayerState = {
  /** Height of the feet above the ground line. */
  y: number;
  vy: number;
  onGround: boolean;
  ducking: boolean;
  holding: boolean;
  /** Seconds since take-off, for stretch, and since landing, for squash. */
  airTime: number;
  landTime: number;
  /** Pending jump pressed just before landing. */
  buffered: number;
  /** Run cycle phase in radians, advanced with distance. */
  stride: number;
  dead: boolean;
  deathTime: number;
};

export function createPlayer(): PlayerState {
  return {
    y: 0,
    vy: 0,
    onGround: true,
    ducking: false,
    holding: false,
    airTime: 0,
    landTime: 1,
    buffered: 0,
    stride: 0,
    dead: false,
    deathTime: 0,
  };
}

/** Press: jumps if grounded, otherwise buffers the press for a moment. */
export function pressJump(p: PlayerState) {
  if (p.dead) return;
  p.holding = true;
  if (p.onGround) launch(p);
  else p.buffered = PLAYER.buffer;
}

export function releaseJump(p: PlayerState) {
  p.holding = false;
  p.buffered = 0;
  // Cut the rise for a short hop, once, while still going up.
  if (!p.onGround && p.vy > 0) p.vy *= PLAYER.shortHop;
}

export function setDuck(p: PlayerState, down: boolean) {
  if (p.dead) return;
  p.ducking = down;
}

function launch(p: PlayerState) {
  p.vy = PLAYER.jumpV;
  p.onGround = false;
  p.airTime = 0;
  p.buffered = 0;
}

/** Advances physics by dt seconds; `speed` (px/s) drives the run cycle. */
export function stepPlayer(p: PlayerState, dt: number, speed: number) {
  if (p.dead) {
    p.deathTime += dt;
    return;
  }
  p.stride += (speed / 34) * dt;
  p.landTime += dt;
  if (p.onGround) {
    if (p.buffered > 0) {
      p.buffered -= dt;
      if (p.holding) launch(p);
    }
    return;
  }
  p.airTime += dt;
  const g = PLAYER.gravity * (p.ducking ? PLAYER.fastFall : 1);
  // Semi-implicit Euler keeps the arc stable at a fixed step.
  p.vy -= g * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) {
    p.y = 0;
    p.vy = 0;
    p.onGround = true;
    p.landTime = 0;
    if (p.buffered > 0 && p.holding) launch(p);
  }
}

/** The bucket's collision box at a given world x, inset so deaths feel fair. */
export function playerBox(p: PlayerState, x: number): Box {
  const h = p.ducking && p.onGround ? PLAYER.duckH : PLAYER.h;
  const w = PLAYER.w;
  const ix = w * PLAYER.hitInset;
  const iy = h * PLAYER.hitInset;
  return { x: x + ix, y: p.y + iy, w: w - ix * 2, h: h - iy * 2 };
}

export type ObstacleKind =
  | "tyres"
  | "tyres2"
  | "cone1"
  | "cone2"
  | "cone3"
  | "bollard"
  | "barrier"
  | "jack"
  | "kiteLow"
  | "kiteHigh";

export type ObstacleDef = {
  kind: ObstacleKind;
  w: number;
  h: number;
  /** Bottom edge above the ground line (kites fly). */
  lift: number;
  /** Score before this kind can appear. */
  minScore: number;
  weight: number;
};

export const OBSTACLES: readonly ObstacleDef[] = [
  { kind: "tyres", w: 34, h: 46, lift: 0, minScore: 0, weight: 5 },
  { kind: "tyres2", w: 72, h: 46, lift: 0, minScore: 150, weight: 3 },
  { kind: "cone1", w: 22, h: 30, lift: 0, minScore: 0, weight: 5 },
  { kind: "cone2", w: 50, h: 30, lift: 0, minScore: 0, weight: 3 },
  { kind: "cone3", w: 78, h: 30, lift: 0, minScore: 120, weight: 2 },
  { kind: "bollard", w: 14, h: 40, lift: 0, minScore: 60, weight: 4 },
  { kind: "barrier", w: 92, h: 36, lift: 0, minScore: 300, weight: 3 },
  { kind: "jack", w: 66, h: 22, lift: 0, minScore: 250, weight: 3 },
  // Head height: a standing bucket (56) hits it, a ducking one (32) passes under.
  { kind: "kiteLow", w: 40, h: 22, lift: 40, minScore: 400, weight: 3 },
  // Above the handle: free to run under, a mistimed jump clips it.
  { kind: "kiteHigh", w: 40, h: 22, lift: 78, minScore: 550, weight: 2 },
];

export const OBSTACLE_INSET = 0.12;

export type Obstacle = { def: ObstacleDef; x: number; id: number };

export function obstacleBox(o: Obstacle): Box {
  const ix = o.def.w * OBSTACLE_INSET;
  const iy = o.def.h * OBSTACLE_INSET;
  return { x: o.x + ix, y: o.def.lift + iy, w: o.def.w - ix * 2, h: o.def.h - iy * 2 };
}

/** A spray bottle: five points, and every ten polish one panel of the car in the bay. */
export const BOTTLE = { w: 14, h: 22, points: 5, perPanel: 10 } as const;

export type Bottle = { x: number; y: number; id: number; taken: boolean };

export function bottleBox(b: Bottle): Box {
  // Generous: pickups should feel magnetic, never fussy.
  return { x: b.x - 4, y: b.y - 4, w: BOTTLE.w + 8, h: BOTTLE.h + 8 };
}

export function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
