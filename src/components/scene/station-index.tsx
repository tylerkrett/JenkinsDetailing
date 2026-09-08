"use client";

import { cn } from "~/lib/cn";
import { useScene } from "~/lib/scene/store";

import { ProgressBar } from "./progress-bar";
import { scrollToProgress } from "./scroll-driver";

export type IndexItem = { slug: string; title: string };

type Props = {
  items: IndexItem[];
  /** The nav's accessible name: "Artworks" in the gallery, "Walls" on the street. */
  label: string;
};

/**
 * Wayfinding and the accessible table of contents for the scene: one tick per piece,
 * the current one lit and numbered, each a real button that scrolls to its hold point
 * in the active world. Hovering or focusing a tick reveals its title. Narrow viewports
 * get a progress bar along the bottom edge instead.
 */
export function StationIndex({ items, label }: Props) {
  const station = useScene((s) => s.station);
  const ready = useScene((s) => s.ready);
  const world = useScene((s) => s.world);
  const n = items.length;
  if (!ready || n === 0) return null;
  // A long hang packs the ticks tighter so the whole index fits a laptop screen.
  const dense = n > 20;

  return (
    <>
      <nav
        aria-label={label}
        className="fixed top-1/2 right-5 z-20 hidden -translate-y-1/2 sm:block"
      >
        <ol className={cn("flex flex-col items-end", dense ? "gap-0.5" : "gap-2")}>
          {items.map((a, i) => {
            const current = i === station;
            return (
              <li key={a.slug} className="group flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="text-bone/70 pointer-events-none text-xs whitespace-nowrap opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  {a.title}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-display text-accent text-xs tabular-nums transition-opacity duration-300 [text-shadow:0_1px_3px_rgba(7,6,11,0.9)]",
                    current
                      ? "opacity-100"
                      : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  aria-label={a.title}
                  aria-current={current ? "true" : undefined}
                  onClick={() => {
                    if (world) scrollToProgress(world.holdProgress(i));
                  }}
                  className={cn("flex w-8 items-center justify-end", dense ? "h-4" : "h-6")}
                >
                  <span
                    className={cn(
                      "ease-out-quint block h-px origin-right transition-[transform,background-color] duration-300",
                      current ? "bg-accent w-8" : "bg-bone/30 group-hover:bg-bone/70 w-4",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <ProgressBar count={n} />
    </>
  );
}
