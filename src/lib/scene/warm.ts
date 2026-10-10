/**
 * Whether the scene has uploaded its textures and compiled its shaders. The preloader
 * waits on it, so the reveal and every act after it play without a compile stall. A
 * fresh promise for each time the canvas mounts.
 */
let resolveWarm: () => void = () => undefined;
let warm = new Promise<void>((resolve) => (resolveWarm = resolve));

export function resetWarm() {
  warm = new Promise<void>((resolve) => (resolveWarm = resolve));
}

export function whenWarm() {
  return warm;
}

export function markWarm() {
  resolveWarm();
}
