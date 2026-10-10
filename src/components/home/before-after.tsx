"use client";

import { ArrowsHorizontal } from "@phosphor-icons/react";
import { useId, useState } from "react";

import { Photo } from "~/components/site/photo";
import type { ProcessedImage, WorkPair } from "~/lib/content";

type Props = {
  pair: WorkPair & { before: ProcessedImage };
  /** How wide the slider renders; full container width by default. */
  sizes?: string;
};

/**
 * One before and after pair as a slider. The control is a native range input stretched
 * over the photos, so dragging, touch and the arrow keys all work and assistive tech
 * hears the split as it moves.
 */
export function BeforeAfter({ pair, sizes = "(min-width: 1280px) 1232px, calc(100vw - 3rem)" }: Props) {
  const [position, setPosition] = useState(50);
  const id = useId();
  return (
    <figure>
      <div className="comparison">
        <Photo image={pair.after} alt={`${pair.title}, after`} sizes={sizes} className="comparison-image h-full!" />
        <div className="comparison-before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <Photo image={pair.before} alt={`${pair.title}, before`} sizes={sizes} className="comparison-image h-full!" />
        </div>
        <span className="comparison-label left-4">Before</span>
        <span className="comparison-label right-4">After</span>
        <div className="comparison-line" style={{ left: `${position}%` }}>
          <span aria-hidden="true">
            <ArrowsHorizontal size={22} weight="bold" />
          </span>
        </div>
        <label htmlFor={id} className="sr-only">
          Compare before and after: {pair.title}
        </label>
        <input
          id={id}
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-valuetext={`${position}% before, ${100 - position}% after`}
          className="comparison-range"
        />
      </div>
      <figcaption className="text-bone/60 mt-4 flex flex-wrap justify-between gap-3 text-sm">
        <span>
          {pair.title}
          {pair.vehicle ? ` / ${pair.vehicle}` : ""}
        </span>
        <span>Drag, or use the arrow keys, to compare</span>
      </figcaption>
    </figure>
  );
}
