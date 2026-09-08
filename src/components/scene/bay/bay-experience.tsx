"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import type { ProcessStep } from "~/lib/content";
import { clamp } from "~/lib/motion";
import { bayLoaders } from "~/lib/scene/assets";
import { detectSceneSupport } from "~/lib/scene/capabilities";
import { ACT_COUNT, OUTRO_SPAN, STEP, THRESHOLD_SPAN, VH_PER_UNIT, bayLayout } from "~/lib/scene/bay-layout";
import { useScene } from "~/lib/scene/store";

import { ChapterCard } from "../chapter-card";
import { CursorRing } from "../cursor-ring";
import { Interaction } from "../interaction";
import { LoadCover } from "../load-cover";
import { Outro } from "../outro";
import { Preloader } from "../preloader";
import { scrollToProgress } from "../scroll-driver";
import { StationCaption } from "../station-caption";
import { StationIndex } from "../station-index";
import { ThresholdTitle } from "../threshold-title";
import { TiltPrompt } from "../tilt-prompt";

type Props = {
  steps: ProcessStep[];
  /** The static home for search engines, reduced motion and no WebGL. */
  fallback: ReactNode;
  headline: string;
  /** The rest of the home page, shown after the reveal. */
  children: ReactNode;
};

function hrefFor(step: ProcessStep) {
  return step.service ? `/services/${step.service}` : `/process#${step.slug}`;
}

/**
 * The bay's DOM. Server-rendered as the static home; once the scene reports it is
 * active this swaps to spacer sections that give the scroll its length, plus caption,
 * index, preloader and keyboard nav.
 */
export function BayExperience({ steps, fallback, headline, children }: Props) {
  const active = useScene((s) => s.active);
  const setWorld = useScene((s) => s.setWorld);
  const router = useRouter();
  const [outro, setOutro] = useState(OUTRO_SPAN);
  const layout = useMemo(() => bayLayout(outro), [outro]);
  const hrefs = useMemo(() => steps.map(hrefFor), [steps]);
  // Which model variant to wait for; decided once the scene is known to be active.
  const loaders = useMemo(() => (active ? bayLoaders(detectSceneSupport().coarsePointer) : []), [active]);

  // The world is published from here, not the canvas, because only the DOM knows how
  // tall the page is. The outro span absorbs everything below the acts so the holds land
  // exactly on their spacer sections whatever the content beneath.
  useEffect(() => {
    if (!active) return;
    setWorld(layout);
  }, [active, layout, setWorld]);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const unit = VH_PER_UNIT * window.innerHeight;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      // Everything above the outro is fixed; the outro absorbs the rest of the page.
      const acts = THRESHOLD_SPAN + ACT_COUNT * STEP;
      const next = Math.max(OUTRO_SPAN, limit / unit - acts);
      setOutro((prev) => (Math.abs(prev - next) < 0.05 ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const { station, stationCount, entering, enterStation } = useScene.getState();
      if (entering) return;
      const go = (i: number) => {
        e.preventDefault();
        scrollToProgress(layout.holdProgress(clamp(i, 0, stationCount - 1)));
      };
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
          return go(station + 1);
        case "ArrowUp":
        case "PageUp":
          return go(station - 1);
        case "Home":
          return go(0);
        case "End":
          return go(stationCount - 1);
        case "Enter": {
          if (enterStation) {
            enterStation();
            return;
          }
          const href = hrefs[station];
          if (href) router.push(href);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, hrefs, layout, router]);

  if (!active)
    return (
      <>
        <LoadCover />
        {fallback}
      </>
    );

  const { threshold, station: stationSpan } = layout.spans;

  return (
    <>
      <Preloader loaders={loaders} />
      <ThresholdTitle headline={headline} />
      <ChapterCard titles={steps.map((s) => s.title)} />
      <main id="main" aria-label="The bay">
        <section style={{ height: `${threshold * VH_PER_UNIT * 100}vh` }} aria-hidden="true" />
        {steps.map((s) => (
          <section
            key={s.slug}
            id={s.slug}
            aria-label={s.title}
            style={{ height: `${stationSpan * VH_PER_UNIT * 100}vh` }}
          />
        ))}
        <Outro minHeight={`${OUTRO_SPAN * VH_PER_UNIT * 100}vh`}>{children}</Outro>
      </main>
      <StationCaption
        items={steps.map((s) => ({
          slug: s.slug,
          title: s.title,
          what: s.what,
          why: s.why,
          href: hrefFor(s),
          linkLabel: s.service ? "About this service" : "How we do it",
        }))}
      />
      <StationIndex label="The process" items={steps} />
      <Interaction hrefs={hrefs} mode="bay" />
      <CursorRing />
      <TiltPrompt />
    </>
  );
}
