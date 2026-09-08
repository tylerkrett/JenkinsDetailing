"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { current } from "~/lib/scene/enter";
import { followUi, pointer } from "~/lib/scene/pointer";
import { useScene } from "~/lib/scene/store";

const RING = 28;
/** Scale factors relative to RING: over a link or button, and over a seated canvas. */
const SCALE_LINK = 40 / RING;
const SCALE_VIEW = 64 / RING;

type Mood = "idle" | "link" | "view";

/**
 * A follower ring for fine pointers. It never hides the native cursor; it reads over
 * any colour through mix-blend-mode: difference, so it lives on <body>, outside the
 * page's stacking context, where it can blend with the WebGL beneath. Position is
 * written straight to the DOM from one rAF loop; React only mounts it.
 */
export function CursorRing() {
  const [enabled, setEnabled] = useState(false);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !reduced.matches);
    update();
    fine.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ring.current;
    const text = label.current;
    if (!el || !text) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let visible = false;
    let overLink = false;
    let mood: Mood = "idle";
    let last = performance.now();
    let raf = 0;

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        // First appearance lands on the pointer instead of sliding in from centre.
        x = targetX;
        y = targetY;
        visible = true;
        el.style.opacity = "1";
      }
      const t = e.target as Element | null;
      overLink = Boolean(t?.closest("a, button, [role='button'], input, select, textarea, label"));
    };
    const hide = () => {
      visible = false;
      el.style.opacity = "0";
    };
    const out = (e: MouseEvent) => {
      if (e.relatedTarget === null) hide();
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      x = followUi(x, targetX, dt);
      y = followUi(y, targetY, dt);

      const { entering, station, mode } = useScene.getState();
      const seated =
        mode === "bay" && current.index === station && current.seated;
      const next: Mood =
        !entering && pointer.hoverCanvas && seated ? "view" : overLink ? "link" : "idle";
      if (next !== mood) {
        mood = next;
        text.style.opacity = mood === "view" ? "1" : "0";
        el.dataset.mood = mood;
      }
      const scale = mood === "view" ? SCALE_VIEW : mood === "link" ? SCALE_LINK : 1;
      el.style.transform = `translate3d(${x - RING / 2}px, ${y - RING / 2}px, 0) scale(${scale})`;
      text.style.transform = `scale(${1 / scale})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseout", out);
    window.addEventListener("blur", hide);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseout", out);
      window.removeEventListener("blur", hide);
    };
  }, [enabled]);

  if (!enabled) return null;

  return createPortal(
    <div
      ref={ring}
      aria-hidden="true"
      data-mood="idle"
      className="ease-out-quint pointer-events-none fixed top-0 left-0 z-[60] flex items-center justify-center rounded-full border border-white opacity-0 transition-transform duration-300 will-change-transform"
      style={{ width: RING, height: RING, mixBlendMode: "difference" }}
    >
      <span
        ref={label}
        className="font-display text-[11px] font-semibold tracking-wide text-white opacity-0 transition-opacity duration-200 select-none"
      >
        View
      </span>
    </div>,
    document.body,
  );
}
