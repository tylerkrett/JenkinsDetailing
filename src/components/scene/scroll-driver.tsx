"use client";

import { useFrame } from "@react-three/fiber";
import Lenis from "lenis";
import { useEffect, useRef } from "react";

import { clamp, lerp } from "~/lib/motion";
import { activeWorld, useScene } from "~/lib/scene/store";
import { beginSwipe, endSwipe, moveSwipe, type SwipeState } from "~/lib/scene/swipe";
import { type WorldLayout, worldSlots } from "~/lib/scene/world";

/** Scroll speed (px per frame at 60fps) that counts as "full" velocity. */
const VELOCITY_FULL = 45;
/** How long the scroll must be still before snapping. */
const SETTLE_MS = 140;
/** How long a committed swipe takes to arrive at the next hold. */
const SWIPE_S = 0.85;
/** Touches that start inside these are the DOM's, never a walk. */
const TOUCH_IGNORE = "a, button, input, textarea, select, [role='dialog'], header, nav";

let lenisRef: Lenis | null = null;

/**
 * Where a swipe can land: -1 is the top of the page, 0..n-1 the holds, n the end. The
 * top only exists when the first hold is some way down (a threshold walk).
 */
function slotProgress(world: WorldLayout, slot: number) {
  const slots = worldSlots(world);
  if (slot < 0) return 0;
  if (slot >= slots.length) return 1;
  return slots[slot]!;
}

function nearestSlot(world: WorldLayout, progress: number) {
  const slots = worldSlots(world);
  const n = slots.length;
  let best = 0;
  let bestD = Infinity;
  for (let k = (slots[0] ?? 0) > 0.002 ? -1 : 0; k <= n; k++) {
    const d = Math.abs(slotProgress(world, k) - progress);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** Progress at which the last hold's dwell ends; from there the DOM outro owns the scroll. */
function pagedUntil(world: WorldLayout) {
  const n = world.stationCount;
  const step = world.spans.station / world.totalTravel;
  return world.holdProgress(n - 1) + world.plateau * step + 0.002;
}

/**
 * Lenis smooth scroll, ticked from the render loop so scroll and camera share a clock.
 * Writes progress and normalised velocity into the store each frame; nothing subscribes
 * to them, so no React work happens on scroll. When the scroll settles inside the
 * station range it eases to the nearest hold point of the active world, so a piece is
 * never left half-shattered or half-pasted. Snap only ever engages after the user has
 * stopped.
 *
 * On touch screens the station range is paged instead: each swipe, up or left to walk
 * on and down or right to walk back, is exactly one piece. The finger scrubs the walk
 * while it is down and the release commits (see lib/scene/swipe.ts). A native fling
 * would otherwise carry the walk past two or three pieces before the snap could act.
 */
export function ScrollDriver() {
  const lenis = useRef<Lenis | null>(null);
  const lastMove = useRef(0);
  const snapping = useRef(false);
  const direction = useRef(0);
  /** Snap only ever follows a real scroll; the page must never move by itself on load. */
  const hasScrolled = useRef(false);
  /** True while a finger is scrubbing the walk; the settle logic stays out of the way. */
  const dragging = useRef(false);
  const paged = useRef(false);
  /** Paging is for touch screens; a trackpad or wheel keeps the free scroll and the snap. */
  const coarse = useRef(false);

  useEffect(() => {
    // Lenis runs on its own frame so scrolling keeps working on routes where the WebGL
    // frameloop is stopped (the colour-accurate artwork pages).
    const instance = new Lenis({ autoRaf: true, lerp: 0.09, smoothWheel: true });
    const setFrame = useScene.getState().setFrame;
    let lastProgress = instance.progress;
    instance.on("scroll", (e) => {
      setFrame(e.progress, clamp(Math.abs(e.velocity) / VELOCITY_FULL, 0, 1));
      // Detect movement from position, not velocity: Lenis reports zero velocity for
      // scrolls it did not animate itself (native, keyboard, some trackpads).
      const delta = e.progress - lastProgress;
      lastProgress = e.progress;
      if (Math.abs(delta) > 1e-6) {
        lastMove.current = performance.now();
        direction.current = Math.sign(delta);
        hasScrolled.current = true;
      }
    });
    lenis.current = instance;
    lenisRef = instance;
    return () => {
      instance.destroy();
      lenis.current = null;
      lenisRef = null;
    };
  }, []);

  // Touch paging. Bound only for coarse pointers; a trackpad keeps the free scroll.
  useEffect(() => {
    coarse.current = window.matchMedia("(pointer: coarse)").matches;
    if (!coarse.current) return;
    let swipe: SwipeState | null = null;
    let origin = 0;
    let world: WorldLayout | null = null;
    let lastPx = 0;
    let lastT = 0;

    const cancel = () => {
      swipe = null;
      dragging.current = false;
    };

    const onStart = (e: TouchEvent) => {
      const l = lenis.current;
      const touch = e.touches[0];
      if (!l || !touch || e.touches.length > 1) return cancel();
      const state = useScene.getState();
      const w = activeWorld(state);
      if (!w || w.stationCount === 0 || !state.ready || state.entering) return cancel();
      const target = e.target as Element | null;
      if (target?.closest(TOUCH_IGNORE) || document.body.style.overflow === "hidden") return cancel();
      // Catch a walk that is still easing: the finger takes over from wherever it is.
      // An immediate scrollTo to where it already is stops the animation in place.
      if (l.isScrolling === "smooth") l.scrollTo(l.scroll, { immediate: true });
      snapping.current = false;
      if (state.progress > pagedUntil(w)) return cancel();
      world = w;
      origin = nearestSlot(w, state.progress);
      swipe = beginSwipe(touch.clientX, touch.clientY);
      lastPx = l.scroll;
      lastT = e.timeStamp;
      dragging.current = true;
    };

    const onMove = (e: TouchEvent) => {
      const l = lenis.current;
      const touch = e.touches[0];
      if (!swipe || !world || !l || !touch) return;
      if (e.touches.length > 1) return cancel();
      if (e.cancelable) e.preventDefault();
      const frac = moveSwipe(swipe, touch.clientX, touch.clientY, e.timeStamp, window.innerWidth, window.innerHeight);
      if (frac === null) return;
      const slots = worldSlots(world);
      const n = slots.length;
      const minSlot = (slots[0] ?? 0) > 0.002 ? -1 : 0;
      const from = slotProgress(world, origin);
      const toward = clamp(origin + (frac >= 0 ? 1 : -1), minSlot, n);
      const progress = lerp(from, slotProgress(world, toward), Math.abs(frac));
      const px = progress * l.limit;
      l.scrollTo(px, { immediate: true });
      // Lenis reports a still scroll for an immediate jump; the walk keeps its pace.
      const dt = Math.max(1, e.timeStamp - lastT);
      const perFrame = (Math.abs(px - lastPx) / dt) * 16.7;
      useScene.getState().setFrame(l.progress, clamp(perFrame / VELOCITY_FULL, 0, 1));
      lastPx = px;
      lastT = e.timeStamp;
    };

    const onEnd = (e: TouchEvent) => {
      const l = lenis.current;
      if (!swipe || !world || !l) return cancel();
      const s = swipe;
      const w = world;
      cancel();
      if (!s.axis) return; // a tap: leave it to the click handlers
      const slots = worldSlots(w);
      const n = slots.length;
      const minSlot = (slots[0] ?? 0) > 0.002 ? -1 : 0;
      const slot = clamp(origin + endSwipe(s, e.timeStamp), minSlot, n);
      const target = slotProgress(w, slot) * l.limit;
      if (Math.abs(l.scroll - target) < 1) return;
      snapping.current = true;
      hasScrolled.current = true;
      l.scrollTo(target, {
        duration: w.swipeSeconds ?? SWIPE_S,
        onComplete: () => {
          snapping.current = false;
          lastMove.current = performance.now();
        },
      });
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      delete document.documentElement.dataset.paged;
      cancel();
    };
  }, []);

  useFrame(() => {
    const l = lenis.current;
    if (!l) return;

    const state = useScene.getState();
    const { progress, ready } = state;
    const world = activeWorld(state);

    // While the camera is among the stations the page is paged, not scrolled: the CSS
    // rule on html[data-paged] turns native touch scrolling off there and the touch
    // handlers above take over. Past the last hold it is a normal page again.
    const isPaged = Boolean(
      coarse.current && world && world.stationCount > 0 && ready && progress <= pagedUntil(world),
    );
    if (isPaged !== paged.current) {
      paged.current = isPaged;
      if (isPaged) document.documentElement.dataset.paged = "";
      else delete document.documentElement.dataset.paged;
    }

    if (process.env.NODE_ENV !== "production") {
      // Screenshot tooling can hold the walk mid-approach by setting this flag.
      if ((window as unknown as { __jdNoSnap?: boolean }).__jdNoSnap) return;
      (window as unknown as { __jdSnap?: unknown }).__jdSnap = {
        hasScrolled: hasScrolled.current,
        isScrolling: l.isScrolling,
        sinceMove: Math.round(performance.now() - lastMove.current),
        direction: direction.current,
        snapping: snapping.current,
        dragging: dragging.current,
        paged: paged.current,
        progress,
        limit: l.limit,
      };
    }
    if (!world || world.stationCount === 0 || !ready || snapping.current || dragging.current) return;
    if (!hasScrolled.current) return;
    if (l.isScrolling || performance.now() - lastMove.current < SETTLE_MS) return;

    // Where the scroll settled, in station units (0 = first hold, 1 = second, ...).
    const n = world.stationCount;
    const first = world.holdProgress(0);
    const step = n > 1 ? world.holdProgress(1) - first : 1;
    const f = (progress - first) / step;
    const plateau = world.plateau;
    const lo = Math.floor(f);
    const frac = f - lo;

    // Where to settle, as 0..1 progress. The two edges are decisive: scrolling up from
    // the first piece goes all the way to the top, scrolling down from the last piece
    // goes all the way to the end, so the header and the outro are always one gesture
    // away. Between pieces, a short scroll continues in the direction of travel and a
    // scroll that stops near a hold settles on it. Inside a piece's plateau, rest.
    // The edges carry a small tolerance: a scroll that lands a pixel short of a hold
    // (rounding at the end of an animation) is resting there, not asking for the top.
    let target: number;
    if (f < -0.01) {
      target = direction.current < 0 ? 0 : first;
    } else if (f > n - 1 + plateau + 0.01) {
      target = direction.current > 0 ? 1 : world.holdProgress(n - 1);
    } else {
      let nearest: number;
      if (frac < 0.1) nearest = lo;
      else if (frac <= plateau) return;
      else if (frac > 0.9) nearest = lo + 1;
      else nearest = direction.current >= 0 ? lo + 1 : lo;
      if (nearest < 0 || nearest >= n) return;
      target = world.holdProgress(nearest);
    }
    if (Math.abs(progress - target) < 0.0005) return;

    snapping.current = true;
    l.scrollTo(target * l.limit, {
      duration: 0.9,
      onComplete: () => {
        snapping.current = false;
        lastMove.current = performance.now();
      },
    });
  });

  return null;
}

/** Programmatic scroll (station index, keyboard nav). No-op before mount. */
export function scrollToProgress(progress: number, duration = 0.9) {
  const l = lenisRef;
  if (!l) return;
  l.scrollTo(progress * l.limit, { duration });
}

/** Jump to the top instantly; used on every route change so pages never inherit a scroll. */
export function resetScroll() {
  lenisRef?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
}
