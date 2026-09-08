"use client";

import { type ReactNode, useEffect, useState } from "react";

import { Mark } from "~/components/site/mark";
import { cn } from "~/lib/cn";
import type { Loader } from "~/lib/scene/assets";
import { useScene } from "~/lib/scene/store";

const MIN_MS = 700;

type Props = {
  /** What the scene genuinely needs before it can be shown; each reports its own 0..1. */
  loaders: Loader[];
  /** A line under the mark; optional. */
  label?: ReactNode;
};

/**
 * Act 0. Covers the scene while its assets genuinely load; the counter is real
 * progress, not a timer. Scroll is locked until it lifts.
 */
export function Preloader({ loaders, label }: Props) {
  const ready = useScene((s) => s.ready);
  const setReady = useScene((s) => s.setReady);
  const [pct, setPct] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const started = performance.now();
    const fractions = loaders.map(() => 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;

    const publish = () => {
      if (cancelled) return;
      const sum = fractions.reduce((a, b) => a + b, 0);
      setPct(Math.round((sum / Math.max(1, fractions.length)) * 100));
    };
    const finish = async () => {
      const wait = MIN_MS - (performance.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;
      setPct(100);
      setReady(true);
      document.body.style.overflow = prev;
    };

    void Promise.all(
      loaders.map((load, i) =>
        load((f) => {
          fractions[i] = Math.max(fractions[i]!, Math.min(1, f));
          publish();
        })
          .catch(() => undefined)
          .then(() => {
            fractions[i] = 1;
            publish();
          }),
      ),
    ).then(finish);

    return () => {
      cancelled = true;
      document.body.style.overflow = prev;
    };
  }, [loaders, setReady]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setGone(true), 800);
    return () => clearTimeout(t);
  }, [ready]);

  if (gone) return null;

  return (
    <div
      aria-live="polite"
      aria-label={ready ? "Loaded" : `Loading, ${pct} percent`}
      className={cn(
        "bg-ink fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 transition-opacity duration-700 ease-out",
        ready && "pointer-events-none opacity-0",
      )}
    >
      <Mark className="h-14 w-auto sm:h-16" />
      {label}
      <p className="text-bone/60 tabular-nums">{pct}%</p>
    </div>
  );
}
