import { clamp, lerp, unlerp } from "~/lib/motion";

import type { CameraPose, Vec3, WorldLayout } from "./world";

/**
 * The bay's geometry and the seven acts as a world. The car sits at the origin, nose
 * toward -z, on the bay floor at y = 0. Each act is a camera pose the scroll approaches,
 * a dwell during which the act's process scrubs 0 to 1, and a leave. Everything is a
 * pure function of scroll progress so scrubbing is exact.
 *
 * Scroll units: THRESHOLD before the first hold, then per act APPROACH + DWELL, then
 * OUTRO while the DOM takes over.
 */

export const ACT_COUNT = 7;
/**
 * Scroll before act 1's approach begins. Kept short: the drive in is the same camera
 * move over the same road either way, and a long threshold only means more scrolling
 * before the chapter card rises. At 1 the page opens just short of the ARRIVE card.
 */
export const THRESHOLD_SPAN = 1;
export const APPROACH_SPAN = 14;
export const DWELL_SPAN = 12;
export const OUTRO_SPAN = 18;
export const STEP = APPROACH_SPAN + DWELL_SPAN;
/** Viewport heights per world unit of scroll; an act is about 1.6 screens. */
export const VH_PER_UNIT = 1.6 / STEP;

/** Bay dimensions in metres. */
export const BAY = {
  halfW: 5.4,
  length: 14,
  height: 3.6,
  /** Where the roller shutter is, along +z; the forecourt lies beyond it. */
  shutterZ: 7,
  /** How high the lift takes the car in act 3. */
  liftHeight: 1.7,
} as const;

/** Car footprint the placeholder and the camera framing agree on. */
export const CAR = { length: 4.5, width: 1.95, height: 1.2 } as const;

/**
 * Where the car starts its drive-in, down the road, and where it pulls up on the
 * forecourt. The page opens on this frame, so it starts level with the near end of the
 * shops (the terrace begins at z 21) rather than away up the street: the whole approach
 * is in view from the first pixel. It has to stay clear of PARK_Z + 12, where the swing
 * across to the garage begins, or the car opens mid-turn.
 */
export const DRIVE_FROM_Z = 27;
export const PARK_Z = 11;

/**
 * The car's z along the scroll: down the road to the forecourt over the opening
 * approach (slowing as it pulls up), into the bay over act 1's dwell, parked after.
 */
export function carZ(u: number) {
  const pullUp = dwellStart(0);
  if (u <= pullUp) {
    const t = clamp(u / pullUp, 0, 1);
    return lerp(DRIVE_FROM_Z, PARK_Z, 1 - (1 - t) * (1 - t));
  }
  const d = clamp((u - pullUp) / DWELL_SPAN, 0, 1);
  return lerp(PARK_Z, 0, smooth(d));
}

/** The car keeps to the left lane down the street and swings to the centre as it turns in. */
export function carX(u: number) {
  return -LANE_X * smooth(unlerp(PARK_Z + 1, PARK_Z + 12, carZ(u)));
}

/** The heading change through that swing: nose to the right, then straight again. */
export function carYaw(u: number) {
  const t = unlerp(PARK_Z + 1, PARK_Z + 12, carZ(u));
  return -0.17 * Math.sin(t * Math.PI);
}

/** Offset of the left lane's centre from the road's centre line. */
const LANE_X = 2.1;

export type Act = {
  slug: string;
  /** Camera at the hold, landscape framing. */
  position: Vec3;
  target: Vec3;
  /** Portrait framing: pulled back and looking along the car. */
  portraitPosition: Vec3;
  portraitTarget: Vec3;
  fov?: number;
  /**
   * A push-in over the dwell: the camera moves from the hold to this pose over the first
   * part of the dwell, stays, and comes back out before the leave.
   */
  push?: { position: Vec3; target: Vec3; fov: number; via?: Vec3 };
};

export const ACTS: readonly Act[] = [
  {
    slug: "arrive",
    position: [5.8, 1.4, 15.2],
    target: [0, 0.8, 11],
    portraitPosition: [3.2, 1.9, 19.5],
    portraitTarget: [0, 1.0, 10.5],
  },
  {
    slug: "wash",
    position: [-4.3, 1.5, -4.4],
    target: [0.2, 0.7, -0.4],
    portraitPosition: [-2.2, 1.8, -6.3],
    portraitTarget: [0, 0.7, -0.2],
  },
  {
    slug: "under",
    position: [-2.3, 0.45, -4.3],
    target: [0.2, 1.2, 0.6],
    portraitPosition: [-1.2, 0.5, -6.2],
    portraitTarget: [0, 1.3, 0.6],
  },
  {
    slug: "inside",
    position: [-3.6, 2.0, -2.9],
    target: [0.3, 0.7, 0.3],
    portraitPosition: [-3.4, 2.2, -4.2],
    portraitTarget: [0.2, 0.7, 0.3],
    // In behind the open door, over the rear quarter, looking forward and down through
    // the aperture at the seat and footwell under the brush; then back out. The way in
    // bends over the car's flank to clear the lift post.
    push: { position: [-2.1, 1.6, 1.35], target: [-0.45, 0.5, -0.05], fov: 40, via: [-1.6, 1.95, -1.2] },
  },
  {
    slug: "correct",
    position: [-2.0, 1.35, -3.6],
    target: [0.1, 0.85, -1.4],
    portraitPosition: [-1.2, 1.7, -5.4],
    portraitTarget: [0, 0.85, -1.3],
  },
  {
    slug: "protect",
    position: [-4.4, 1.0, -2.6],
    target: [0.3, 0.7, 0.4],
    portraitPosition: [-3.4, 1.4, -5.6],
    portraitTarget: [0, 0.7, 0],
  },
  {
    slug: "reveal",
    position: [4.4, 1.6, -5.6],
    target: [-0.5, 0.7, -1.1],
    portraitPosition: [2.4, 2, -6.4],
    portraitTarget: [0, 0.6, -0.2],
    fov: 46,
  },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Quadratic bezier from a through the control c to b. */
function bezier(a: Vec3, c: Vec3, b: Vec3, t: number): Vec3 {
  const s = 1 - t;
  return [
    s * s * a[0] + 2 * s * t * c[0] + t * t * b[0],
    s * s * a[1] + 2 * s * t * c[1] + t * t * b[1],
    s * s * a[2] + 2 * s * t * c[2] + t * t * b[2],
  ];
}

/** Catmull-Rom between p1 and p2 with p0 and p3 as the neighbours. */
function catmull(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    out.push(
      0.5 *
        (2 * p1[i]! +
          (-p0[i]! + p2[i]!) * t +
          (2 * p0[i]! - 5 * p1[i]! + 4 * p2[i]! - p3[i]!) * t2 +
          (-p0[i]! + 3 * p1[i]! - 3 * p2[i]! + p3[i]!) * t3),
    );
  }
  return out as unknown as Vec3;
}

export function totalTravel(outroSpan = OUTRO_SPAN) {
  return THRESHOLD_SPAN + ACT_COUNT * STEP + outroSpan;
}

/** Scroll units at which act i's dwell begins. */
export function dwellStart(i: number) {
  return THRESHOLD_SPAN + APPROACH_SPAN + i * STEP;
}

export type ActState = {
  /** Index of the act the camera belongs to. */
  act: number;
  /** 0..1 along the approach to this act's hold (1 at the hold). */
  approach: number;
  /** 0..1 through this act's dwell: the process. */
  dwell: number;
};

/** Which act a 0..1 progress is in, how far along its approach and its dwell. */
export function actState(progress: number, total = totalTravel()): ActState {
  const u = clamp(progress, 0, 1) * total;
  const rel = u - THRESHOLD_SPAN;
  const act = clamp(Math.floor(rel / STEP), 0, ACT_COUNT - 1);
  const local = rel - act * STEP;
  return {
    act,
    approach: clamp(local / APPROACH_SPAN, 0, 1),
    dwell: clamp((local - APPROACH_SPAN) / DWELL_SPAN, 0, 1),
  };
}

function pick(act: Act, portrait: boolean): { position: Vec3; target: Vec3 } {
  return portrait
    ? { position: act.portraitPosition, target: act.portraitTarget }
    : { position: act.position, target: act.target };
}

/**
 * The chase during the drive-in: the camera rides behind and beside the car, in the
 * car's frame (nose toward -z), and lets it pull ahead as it slows for the forecourt.
 */
const CHASE = { offset: [3.4, 1.5, 7.5] as Vec3, look: [0, 0.75, -2.5] as Vec3 };
const CHASE_PORTRAIT = { offset: [1.4, 2.0, 9.5] as Vec3, look: [0, 0.8, -2] as Vec3 };
/** The camera flies in through the doorway on its way from the forecourt to the wash bay. */
const DOOR: Vec3 = [-1.8, 2.0, 10.5];
/** How far, in radians, the camera swings round the car over the reveal's dwell. */
const REVEAL_SWING = 0.55;
/** A tangent control for the first hold-to-hold segment; never shown. */
const START: { position: Vec3; target: Vec3 } = { position: [8, 1.5, 24], target: [0, 0.8, 11] };
/** After the last hold the camera rises toward the ceiling, looking down at the car, while the DOM takes over. */
const END: { position: Vec3; target: Vec3 } = { position: [3.2, 3.1, -4.2], target: [0, 0.5, 0.3] };

/**
 * The bay as a world. `outroSpan` is measured by the DOM side so the world's total
 * travel matches the real page height: the page below the acts is as tall as its
 * content, and the holds must still land exactly on their spacer sections.
 */
export function bayLayout(outroSpan = OUTRO_SPAN): WorldLayout {
  const total = totalTravel(outroSpan);
  return {
    kind: "bay",
    stationCount: ACT_COUNT,
    totalTravel: total,
    pose: (progress, aspect): CameraPose => {
      const portrait = aspect < 1;
      const u = clamp(progress, 0, 1) * total;
      const poses = [START, ...ACTS.map((a) => pick(a, portrait)), END];
      const fovs = [50, ...ACTS.map((a) => a.fov ?? 50), 50];
      const arrive = poses[1]!;
      const wash = poses[2]!;
      const pullUp = dwellStart(0);

      // The drive-in: chase the car down the road, then drift off to the forecourt hold
      // as it pulls up.
      if (u < pullUp) {
        const z = carZ(u);
        const x = carX(u);
        const chase = portrait ? CHASE_PORTRAIT : CHASE;
        const cp: Vec3 = [x + chase.offset[0], chase.offset[1], z + chase.offset[2]];
        const ct: Vec3 = [x + chase.look[0], chase.look[1], z + chase.look[2]];
        const w = smooth(unlerp(0.42, 1, u / pullUp));
        return { position: mix(cp, arrive.position, w), target: mix(ct, arrive.target, w), fov: 50 };
      }
      // The arrive hold: the camera stands on the forecourt and follows the car into the bay.
      const follow = (z: number): Vec3 => [arrive.target[0], arrive.target[1], arrive.target[2] - PARK_Z + z];
      if (u < pullUp + DWELL_SPAN) {
        return { position: arrive.position, target: follow(carZ(u)), fov: 50 };
      }
      // Forecourt to wash: in through the doorway on a bend, the car already parked.
      if (u < dwellStart(1)) {
        const t = smooth(clamp((u - pullUp - DWELL_SPAN) / APPROACH_SPAN, 0, 1));
        const position = bezier(arrive.position, DOOR, wash.position, t);
        const target = mix(follow(0), wash.target, t);
        return { position, target, fov: lerp(50, fovs[2]!, t) };
      }

      // Acts with a push-in: dolly in over the first third of the dwell, hold, and come
      // back out over the last third, so the leave starts from the hold pose again.
      for (let i = 0; i < ACT_COUNT; i++) {
        const push = ACTS[i]!.push;
        if (!push) continue;
        const start = dwellStart(i);
        if (u < start || u > start + DWELL_SPAN) continue;
        const d = (u - start) / DWELL_SPAN;
        const k = smooth(unlerp(0.02, 0.34, d)) * (1 - smooth(unlerp(0.66, 0.98, d)));
        const hold = poses[i + 1]!;
        return {
          position: push.via ? bezier(hold.position, push.via, push.position, k) : mix(hold.position, push.position, k),
          target: mix(hold.target, push.target, k),
          fov: lerp(fovs[i + 1]!, push.fov, k),
        };
      }

      // The reveal: over its dwell the camera swings slowly round the front of the finished
      // car, and the outro carries on from wherever that swing ended.
      const reveal = poses[ACT_COUNT]!;
      const revealStart = dwellStart(ACT_COUNT - 1);
      const orbit = (d: number): Vec3 => {
        const [px, py, pz] = reveal.position;
        const [tx, , tz] = reveal.target;
        const k = smooth(d);
        // Swing toward the nose and dolly in as it goes, so the arc stays inside the bay.
        const ang = -k * REVEAL_SWING;
        const r = 1 - k * 0.3;
        const dx = (px - tx) * r;
        const dz = (pz - tz) * r;
        return [tx + dx * Math.cos(ang) - dz * Math.sin(ang), py - k * 0.35, tz + dx * Math.sin(ang) + dz * Math.cos(ang)];
      };
      if (u >= revealStart && u < revealStart + DWELL_SPAN) {
        return { position: orbit((u - revealStart) / DWELL_SPAN), target: reveal.target, fov: fovs[ACT_COUNT]! };
      }
      if (u >= revealStart + DWELL_SPAN) {
        const t = smooth(clamp((u - revealStart - DWELL_SPAN) / OUTRO_SPAN, 0, 1));
        const end = poses[ACT_COUNT + 1]!;
        return { position: mix(orbit(1), end.position, t), target: mix(reveal.target, end.target, t), fov: lerp(fovs[ACT_COUNT]!, 50, t) };
      }

      // Segment k runs from pose k's hold to pose k+1's hold; the dwell of pose k+1 is
      // consumed standing still at its hold.
      const rel = u - THRESHOLD_SPAN;
      const k = Math.floor(rel / STEP);
      const t = smooth(clamp((rel - k * STEP) / APPROACH_SPAN, 0, 1));
      const p0 = poses[Math.max(0, k - 1)]!;
      const p1 = poses[k]!;
      const p2 = poses[Math.min(poses.length - 1, k + 1)]!;
      const p3 = poses[Math.min(poses.length - 1, k + 2)]!;
      const position = catmull(p0.position, p1.position, p2.position, p3.position, t);
      const target = mix(p1.target, p2.target, t);
      const fov = lerp(fovs[k]!, fovs[Math.min(fovs.length - 1, k + 1)]!, t);
      return { position, target, fov };
    },
    holdProgress: (i) => clamp(dwellStart(i) / total, 0, 1),
    nearestStation: (progress) => {
      const u = clamp(progress, 0, 1) * total;
      // The act whose hold the camera is nearest, measured along the scroll.
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < ACT_COUNT; i++) {
        const start = dwellStart(i);
        const d = u < start ? start - u : u > start + DWELL_SPAN ? u - start - DWELL_SPAN : 0;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    plateau: DWELL_SPAN / STEP,
    spans: { threshold: THRESHOLD_SPAN + APPROACH_SPAN, station: STEP, outro: outroSpan },
    // Two slots per act: the dwell start and the dwell end, so one swipe plays the
    // process and the next walks on.
    slots: () =>
      Array.from({ length: ACT_COUNT }, (_, i) => [
        dwellStart(i) / total,
        (dwellStart(i) + DWELL_SPAN) / total,
      ]).flat(),
    swipeSeconds: 1.2,
  };
}

/** 0..1 how much the camera is standing at act i's hold, for captions and lamps. */
export function holdWeight(progress: number, i: number, total = totalTravel()) {
  const u = clamp(progress, 0, 1) * total;
  const start = dwellStart(i);
  if (u >= start && u <= start + DWELL_SPAN) return 1;
  const d = u < start ? start - u : u - start - DWELL_SPAN;
  return 1 - unlerp(0, APPROACH_SPAN * 0.5, d);
}
