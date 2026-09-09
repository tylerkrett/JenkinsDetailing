"use client";

import { useEffect, useRef } from "react";

import { APPROACH_SPAN, STEP, THRESHOLD_SPAN } from "~/lib/scene/bay-layout";
import { unlerp } from "~/lib/motion";
import { useScene } from "~/lib/scene/store";

type Props = { titles: string[] };

/**
 * The chapter card: the act's number and title in the display face, large, over the
 * scene as the camera approaches the hold, gone by the time the hold begins so the
 * caption has the frame to itself. Driven straight from the store's progress; no
 * React work per frame.
 */
export function ChapterCard({ titles }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const title = useRef<HTMLSpanElement>(null);
  const ready = useScene((s) => s.ready);

  useEffect(() => {
    let shown = -1;
    const apply = (s: ReturnType<typeof useScene.getState>) => {
      const node = el.current;
      const world = s.world;
      if (!node || !world) return;
      const u = s.progress * world.totalTravel;
      const rel = u - THRESHOLD_SPAN;
      const act = Math.max(0, Math.min(titles.length - 1, Math.floor(rel / STEP)));
      const local = rel - act * STEP;
      // Rise over the first quarter of the approach, hold, fall away before the dwell.
      const inA = unlerp(APPROACH_SPAN * 0.12, APPROACH_SPAN * 0.32, local);
      const outA = 1 - unlerp(APPROACH_SPAN * 0.72, APPROACH_SPAN * 0.95, local);
      const a = rel < 0 ? 0 : Math.min(inA, outA);
      node.style.opacity = String(a);
      node.style.transform = `translateY(${(1 - inA) * 24}px)`;
      if (act !== shown) {
        shown = act;
        if (number.current) number.current.textContent = String(act + 1).padStart(2, "0");
        if (title.current) title.current.textContent = titles[act] ?? "";
      }
    };
    apply(useScene.getState());
    return useScene.subscribe(apply);
  }, [titles]);

  if (!ready) return null;

  return (
    <div
      ref={el}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-[22vh] z-20 flex flex-col items-center px-6 text-center opacity-0 will-change-[opacity,transform]"
    >
      <span ref={number} className="font-display text-accent-lit text-sm font-bold tabular-nums" />
      <span
        ref={title}
        className="font-display text-display-xl mt-2 font-extrabold tracking-tight text-white uppercase [text-shadow:0_2px_24px_rgba(6,8,15,0.8)]"
      />
    </div>
  );
}
