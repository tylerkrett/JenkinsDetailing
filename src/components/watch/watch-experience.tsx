"use client";

import type { ReactNode } from "react";

import { BayExperience } from "~/components/scene/bay/bay-experience";
import { SceneLoader } from "~/components/scene/scene-loader";
import type { ProcessStep } from "~/lib/content";

type Props = { steps: ProcessStep[]; headline: string; fallback: ReactNode; children: ReactNode };

/** The 3D view: the canvas and the bay's DOM. Loaded on demand, so only /watch ever pays for three.js. */
export function WatchExperience({ steps, headline, fallback, children }: Props) {
  return (
    <>
      <SceneLoader />
      <BayExperience steps={steps} headline={headline} fallback={fallback}>
        {children}
      </BayExperience>
    </>
  );
}
