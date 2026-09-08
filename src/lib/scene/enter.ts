import type { Vec3 } from "./world";

/**
 * Per-frame state shared between the DOM interaction layer and the in-canvas camera for
 * click-to-enter. Plain mutable objects, read inside useFrame, never subscribed to.
 *
 * Sequence: the DOM side calls `beginDolly`; the camera rig springs toward `target` and
 * calls `onSettled` once it has arrived; the DOM side then fades the canvas and
 * navigates. The bay has no flat station to match a rectangle to, so the hand-over is a
 * plain fade.
 */

/** Dwell fraction above which a station counts as at its hold (hover affordance, enter). */
export const SEATED = 0.02;

export type EnterTarget = {
  position: Vec3;
  target: Vec3;
};

export const enter = {
  phase: "idle" as "idle" | "dolly" | "cover",
  target: null as EnterTarget | null,
  onSettled: null as (() => void) | null,
  /** The DOM element wrapping the WebGL canvas, published by the camera rig. */
  canvasWrapper: null as HTMLElement | null,
};

/**
 * Written each frame by the active world: which station is current, whether the
 * camera is at its hold, and a hit test in NDC against the hero object so a tap can be
 * checked by the DOM layer.
 */
export const current = {
  index: -1,
  seated: false,
  hit: null as ((ndcX: number, ndcY: number) => boolean) | null,
};

export function beginDolly(target: EnterTarget, onSettled: () => void) {
  enter.target = target;
  enter.onSettled = onSettled;
  enter.phase = "dolly";
}

export function resetEnter() {
  enter.phase = "idle";
  enter.target = null;
  enter.onSettled = null;
}
