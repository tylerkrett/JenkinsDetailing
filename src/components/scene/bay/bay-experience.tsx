"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

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
  /** The plain steps, shown under the loading cover until the scene is active. */
  fallback: ReactNode;
  headline: string;
  /** What follows the reveal. */
  children: ReactNode;
};

function hrefFor(step: ProcessStep) {
  return step.service ? `/services/${step.service}` : `/watch?view=plain#${step.slug}`;
}

/**
 * The bay's DOM on the watch page. Renders the plain steps until the scene reports it is
 * active, then swaps to spacer sections that give the scroll its length, plus caption,
 * index, preloader and keyboard nav.
 */
export function BayExperience({ steps, fallback, headline, children }: Props) {
  const active = useScene((s) => s.active);
  const ready = useScene((s) => s.ready);
  const setWorld = useScene((s) => s.setWorld);
  const router = useRouter();
  const [outro, setOutro] = useState(OUTRO_SPAN);
  const layout = useMemo(() => bayLayout(outro), [outro]);
  const hrefs = useMemo(() => steps.map(hrefFor), [steps]);
  // Which model variant to wait for; decided once the scene is known to be active.
  const loaders = useMemo(() => (active ? bayLoaders(detectSceneSupport().coarsePointer) : []), [active]);

  // A step linked from the home page (?act=3) opens at that act's hold, once, as soon as
  // the scene is ready. Later layout changes must not pull the visitor back there.
  const jumped = useRef(false);
  useEffect(() => {
    if (!active || !ready || jumped.current) return;
    jumped.current = true;
    const act = Number(new URLSearchParams(window.location.search).get("act"));
    if (Number.isInteger(act) && act >= 1 && act <= steps.length) scrollToProgress(layout.holdProgress(act - 1), 0.01);
  }, [active, ready, layout, steps.length]);

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
      // Form fields and dialogs keep their keys, and Enter on a link or button belongs to it.
      if (t?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if (e.key === "Enter" && t?.closest("a, button, [role='button']")) return;
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
