"use client";

import { useEffect, useRef } from "react";

import { useScene } from "~/lib/scene/store";

/**
 * The station index collapsed for narrow viewports: a 2px gold line along the bottom
 * edge that follows scroll progress (the count sits in the caption bar). Progress
 * is written straight to the transform from the store, so nothing renders per frame.
 */
export function ProgressBar(_props: { count: number }) {
  const line = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let last = -1;
    return useScene.subscribe((s) => {
      if (s.progress === last) return;
      last = s.progress;
      const node = line.current;
      if (node) node.style.transform = `scaleX(${s.progress})`;
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 sm:hidden"
    >
      <div
        ref={line}
        className="bg-accent h-0.5 w-full origin-left"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
