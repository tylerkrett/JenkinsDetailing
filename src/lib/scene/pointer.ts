import { DAMP_UI } from "~/lib/motion";

/**
 * Frame-rate data that must never trigger React renders: pointer position in normalised
 * device coordinates (-1..1), whether a fine pointer is present, the gyroscope's
 * equivalent on coarse devices, and whether the pointer currently rests on the seated
 * canvas of the current station (written by that station each frame).
 */
export const pointer = {
  x: 0,
  y: 0,
  /** True while a mouse is over the window. */
  active: false,
  /** Device tilt mapped to -1..1, centred on the orientation at grant time. */
  tiltX: 0,
  tiltY: 0,
  tiltActive: false,
  /** True while a fine pointer rests on a seated canvas. */
  hoverCanvas: false,
};

/** The parallax input the camera should follow: the mouse when present, else tilt. */
export function parallaxInput(): { x: number; y: number } {
  if (pointer.active) return { x: pointer.x, y: pointer.y };
  if (pointer.tiltActive) return { x: pointer.tiltX, y: pointer.tiltY };
  return { x: 0, y: 0 };
}

/**
 * Per-frame follower step using the UI damping token: DAMP_UI is the fraction closed per
 * 60fps frame, made frame-rate independent here so cursor, hover and tilt all share it.
 */
export function followUi(current: number, target: number, dt: number) {
  const k = 1 - Math.pow(1 - DAMP_UI, dt * 60);
  return current + (target - current) * k;
}

export function bindPointer() {
  if (typeof window === "undefined") return () => undefined;
  const move = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    pointer.active = e.pointerType === "mouse";
  };
  const leave = () => {
    pointer.active = false;
  };
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerleave", leave);
  return () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerleave", leave);
  };
}

/** Tilt angle (degrees) that maps to full parallax. */
const TILT_RANGE = 18;

/**
 * Feeds device orientation into the same parallax path the mouse uses. Centres on the
 * first reading so the pose the visitor holds the phone in is "straight ahead".
 * Returns an unbind; the caller handles permission.
 */
export function bindTilt() {
  if (typeof window === "undefined") return () => undefined;
  let base: { gamma: number; beta: number } | null = null;
  const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

  const onOrientation = (e: DeviceOrientationEvent) => {
    if (e.gamma === null || e.beta === null) return;
    base ??= { gamma: e.gamma, beta: e.beta };
    // Left-right tilt turns the view; front-back tilt raises it. Both clamped.
    pointer.tiltX = clamp1((e.gamma - base.gamma) / TILT_RANGE);
    pointer.tiltY = clamp1(-(e.beta - base.beta) / TILT_RANGE);
    pointer.tiltActive = true;
  };
  const recentre = () => {
    base = null;
  };

  window.addEventListener("deviceorientation", onOrientation);
  window.addEventListener("orientationchange", recentre);
  return () => {
    window.removeEventListener("deviceorientation", onOrientation);
    window.removeEventListener("orientationchange", recentre);
    pointer.tiltActive = false;
    pointer.tiltX = 0;
    pointer.tiltY = 0;
  };
}
