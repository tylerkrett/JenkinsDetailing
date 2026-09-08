/**
 * The site's single motion language. Every easing, damping and spring constant lives
 * here so the corridor, the UI and the transitions read as one object.
 *
 * Rule: things arrive slowly and leave quickly. Scroll-driven motion is scrubbed (a pure
 * function of scroll position); only ambient motion runs on the clock.
 */

export const SPRING_CAMERA = { stiffness: 120, damping: 20, mass: 1 } as const;

/** Frame-rate independent damping factor for UI followers (cursor, parallax, hover). */
export const DAMP_UI = 0.15;

/** Fraction of an assembly window spent on per-tile stagger. */
export const STAGGER = 0.35;

export const EASE = {
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
} as const;

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Maps v from [a, b] to [0, 1], clamped. */
export const unlerp = (a: number, b: number, v: number) =>
  a === b ? 0 : clamp((v - a) / (b - a), 0, 1);

/**
 * Exponential damping that is independent of frame rate. `lambda` is the rate: ~6 feels
 * snappy, ~3 feels heavy. Use in useFrame with the frame delta.
 */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Critically-damped-ish spring step; returns the new [value, velocity]. */
export function springStep(
  value: number,
  velocity: number,
  target: number,
  dt: number,
  { stiffness, damping, mass }: { stiffness: number; damping: number; mass: number } = SPRING_CAMERA,
): [number, number] {
  const force = -stiffness * (value - target) - damping * velocity;
  const v = velocity + (force / mass) * dt;
  return [value + v * dt, v];
}
