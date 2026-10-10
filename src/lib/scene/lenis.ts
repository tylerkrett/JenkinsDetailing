import type Lenis from "lenis";

/**
 * The smooth-scroll instance the scene's driver owns while the 3D view is mounted. It
 * lives here, apart from the driver, so pages can reset the scroll without importing
 * the driver and with it react-three-fiber and three.
 */
let current: Lenis | null = null;

export function setLenis(instance: Lenis | null) {
  current = instance;
}

export function getLenis() {
  return current;
}

/** Jump to the top instantly; used on every route change so pages never inherit a scroll. */
export function resetScroll() {
  current?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
}
