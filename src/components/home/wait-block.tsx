"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

const STORAGE_KEY = "jd:play:best";

/** The player's best run, read once on the client. Zero means they have not played yet. */
function useBestScore() {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const n = raw == null ? 0 : Number(raw);
      setBest(Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
    } catch {
      // Private mode or storage blocked: fall back to the copy that works without it.
      setBest(0);
    }
  }, []);
  return best;
}

/**
 * The homepage nudge for the game. Sits under the quote section so the promise of a
 * reply lands before the thing to do while waiting for one.
 */
export function WaitBlock() {
  const best = useBestScore();

  return (
    <section aria-labelledby="while-you-wait" className="site-container section-space">
      <div
        data-reveal
        className={cn(
          "grid gap-10 rounded-md p-8 sm:p-10",
          "lg:grid-cols-12 lg:items-center lg:gap-12",
        )}
        style={{ background: "var(--color-photo-surface)" }}
      >
        <div className="lg:col-span-7">
          <p className="eyebrow">While you wait</p>
          <h2 id="while-you-wait" className="font-display text-display-lg mt-4 font-bold tracking-tight">
            Waiting on a price? Play the shift.
          </h2>
          <p className="text-bone/80 mt-6 max-w-[52ch]">
            Bucket Run is our endless runner: a wash bucket down the forecourt at Rose Garage, jumping cones and
            collecting bottles. No sign-up, nothing to install, and it keeps working when the signal drops.
          </p>
          {best === null ? null : best > 0 ? (
            <p className="text-bone/60 mt-6 text-sm">
              Your best on this device is{" "}
              <span className="font-display text-display-md font-bold tabular-nums text-bone">{best}</span> points.
            </p>
          ) : (
            <p className="text-bone/60 mt-6 text-sm">Your best score is saved on this device, never sent anywhere.</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/play" className="button-primary">
              Play Bucket Run
            </Link>
            <Link href="/watch" className="button-outline">
              Watch a car instead
            </Link>
          </div>
        </div>
        <p className="text-bone/55 text-sm lg:col-span-5 lg:text-right">
          Works offline. Keep the tab open and the best score waits for you.
        </p>
      </div>
    </section>
  );
}