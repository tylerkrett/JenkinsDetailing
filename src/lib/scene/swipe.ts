/**
 * Touch paging for the walkable worlds. On a phone a native fling carries the walk past
 * two or three pieces before the snap can catch it, so while the camera is among the
 * stations every swipe is one step: up or left walks on, down or right walks back.
 * The finger scrubs the walk while it is down (the piece starts to assemble under it),
 * and the release commits to the next hold or eases back. Past the last hold the DOM
 * outro takes over and touch scrolls natively again.
 *
 * Pure gesture maths, no DOM, so it can be unit-reasoned: the driver feeds it touches.
 */

/** Finger travel before a gesture commits to an axis. */
const AXIS_LOCK_PX = 8;
/** Fraction of the axis (viewport width or height) that scrubs one whole step. */
const STEP_FRACTION = 0.7;
/** Fraction of a step the finger must cover to commit without a flick. */
const COMMIT_FRACTION = 0.18;
/** Finger speed (px/ms) that commits as a flick regardless of distance. */
const FLICK_PX_MS = 0.45;
/** Samples older than this do not count toward flick velocity. */
const FLICK_WINDOW_MS = 90;

export type Axis = "x" | "y" | null;

export type SwipeState = {
  x0: number;
  y0: number;
  axis: Axis;
  /** Signed step fraction: positive walks on. */
  frac: number;
  samples: { t: number; d: number }[];
};

export function beginSwipe(x: number, y: number): SwipeState {
  return { x0: x, y0: y, axis: null, frac: 0, samples: [] };
}

/**
 * Feeds a move. Returns the signed step fraction (-1..1) the finger has scrubbed, or
 * null while the gesture has not yet chosen an axis.
 */
export function moveSwipe(
  s: SwipeState,
  x: number,
  y: number,
  t: number,
  width: number,
  height: number,
): number | null {
  const dx = x - s.x0;
  const dy = y - s.y0;
  if (!s.axis) {
    if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return null;
    s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  }
  // Walking on is up or left, so the advance is the negative finger travel.
  const d = s.axis === "x" ? -dx : -dy;
  const size = s.axis === "x" ? width : height;
  s.frac = Math.max(-1, Math.min(1, d / (size * STEP_FRACTION)));
  s.samples.push({ t, d });
  while (s.samples.length > 1 && t - s.samples[0]!.t > FLICK_WINDOW_MS) s.samples.shift();
  return s.frac;
}

/** Which way the release commits: 1 on, -1 back, 0 to stay where the gesture began. */
export function endSwipe(s: SwipeState, t: number): -1 | 0 | 1 {
  if (!s.axis) return 0;
  const first = s.samples[0];
  const last = s.samples[s.samples.length - 1];
  let v = 0;
  if (first && last && last.t > first.t && t - last.t < FLICK_WINDOW_MS) {
    v = (last.d - first.d) / (last.t - first.t);
  }
  if (Math.abs(v) > FLICK_PX_MS) return v > 0 ? 1 : -1;
  if (Math.abs(s.frac) > COMMIT_FRACTION) return s.frac > 0 ? 1 : -1;
  return 0;
}
