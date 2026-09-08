"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { useScene } from "~/lib/scene/store";

/**
 * What the world hands the caption for each act: the two-word title, one line of what
 * is being done and one line of why, and where the act leads.
 */
export type CaptionItem = {
  slug: string;
  title: string;
  what: string;
  why: string;
  href: string;
  linkLabel: string;
};

type Props = { items: CaptionItem[] };

/**
 * The current act's label, real DOM so it is readable, selectable and crawlable. Two
 * layouts: a block bottom-left on wide screens, a bar along the bottom on phones.
 * Both fade with distance from the hold and re-run the reveal per act.
 */
export function StationCaption({ items }: Props) {
  const station = useScene((s) => s.station);
  const ready = useScene((s) => s.ready);
  const world = useScene((s) => s.world);
  const block = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const a = items[station];

  // Fade with distance from the act's dwell; runs off the store's per-frame progress
  // without re-rendering anything.
  useEffect(() => {
    if (!world) return;
    const total = world.totalTravel;
    const plateauUnits = world.spans.station * world.plateau;
    const span = ((world.spans.station - plateauUnits) * 0.4) / total;
    const plateau = plateauUnits / total;
    return useScene.subscribe((s) => {
      const start = world.holdProgress(s.station);
      const end = start + plateau;
      const d = s.progress < start ? start - s.progress : s.progress > end ? s.progress - end : 0;
      const opacity = String(Math.max(0, 1 - d / span));
      if (block.current) block.current.style.opacity = opacity;
      if (bar.current) bar.current.style.opacity = opacity;
    });
  }, [world]);

  if (!a || !ready) return null;

  const onView = (e: React.MouseEvent) => {
    // Fly into the act when the scene can; otherwise it is a normal link.
    const enter = useScene.getState().enterStation;
    if (enter) {
      e.preventDefault();
      enter();
    }
  };
  const count = `${String(station + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;

  return (
    <>
      {/* Wide screens: a block bottom-left, beside the car. */}
      <div
        ref={block}
        className="pointer-events-none fixed bottom-10 left-6 z-20 hidden max-w-[min(40ch,26vw)] sm:left-10 sm:block"
      >
        <div
          aria-hidden="true"
          className="from-ink/85 via-ink/55 pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 rounded-[3rem] bg-radial to-transparent blur-2xl"
        />
        <div key={a.slug} className="caption-in">
          <p className="font-display text-accent text-xs font-semibold tabular-nums">{count}</p>
          <h2 className="font-display text-display-md xl:text-display-lg mt-2 font-bold tracking-tight">
            {a.title}
          </h2>
          <p className="text-bone/90 mt-4 leading-relaxed">{a.what}</p>
          <p className="text-bone/60 mt-2 leading-relaxed">{a.why}</p>
          <Link
            href={a.href}
            onClick={onView}
            className="text-accent hover:text-accent-lit focus-visible:text-accent-lit pointer-events-auto mt-5 inline-block font-medium underline-offset-[6px] transition-colors hover:underline"
          >
            {a.linkLabel}
          </Link>
        </div>
      </div>

      {/* Phones: a bar along the bottom, under the car, over a scrim. */}
      <div
        ref={bar}
        className="from-ink via-ink/85 pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t to-transparent px-5 pt-14 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:hidden"
      >
        <div key={a.slug} className="caption-in flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-accent text-xs tabular-nums">{count}</p>
            <h2 className="font-display mt-1 line-clamp-2 text-2xl leading-tight font-bold">{a.title}</h2>
            <p className="text-bone/80 mt-1 line-clamp-2 text-sm">{a.what}</p>
            <p className="text-bone/55 mt-1 line-clamp-2 text-sm">{a.why}</p>
          </div>
          <Link
            href={a.href}
            onClick={onView}
            className="border-accent text-accent active:bg-accent active:text-ink pointer-events-auto inline-flex h-11 shrink-0 items-center border px-4 font-medium transition-colors"
          >
            More
          </Link>
        </div>
      </div>
    </>
  );
}
