"use client";

import { useEffect, useRef } from "react";

import { unlerp } from "~/lib/motion";
import { useScene } from "~/lib/scene/store";

/** Act 1: the headline in the dark before the first piece, fading out on the first scroll. */
export function ThresholdTitle({ headline }: { headline: string }) {
  const el = useRef<HTMLDivElement>(null);
  const ready = useScene((s) => s.ready);

  useEffect(
    () =>
      useScene.subscribe((s) => {
        const node = el.current;
        if (!node) return;
        const t = unlerp(0.0, 0.05, s.progress);
        node.style.opacity = String(1 - t);
        node.style.transform = `translateY(${-t * 40}px)`;
      }),
    [],
  );

  if (!ready) return null;

  return (
    // The stencilled name on the wall is the visual headline; this keeps the page's h1
    // for assistive tech and search without drawing text over the mural.
    <div ref={el} className="sr-only">
      <h1>{headline}</h1>
    </div>
  );
}
