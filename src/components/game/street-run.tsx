"use client";

import { ShareNetwork } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CreateGame, GameHandle, GameState } from "~/game/types";
import { cn } from "~/lib/cn";

const SITE = "jenkinsdetailing.com/play";

type Status = "loading" | "ready" | "missing";

/**
 * The Bucket Run game on the site. Gives the engine a sized canvas and drives it only
 * through the public contract in ~/game/types. The engine is loaded on the client after
 * mount so none of it is server rendered; the same engine is bundled into the offline page.
 */
export function StreetRun({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [state, setState] = useState<GameState | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: GameHandle | null = null;
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");

    import("~/game/engine")
      .then((mod: { createGame?: CreateGame; default?: CreateGame }) => {
        if (cancelled) return;
        const create = mod.createGame ?? mod.default;
        if (typeof create !== "function") {
          setStatus("missing");
          return;
        }
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        handle = create(canvas, {
          reducedMotion,
          onState: (s) => {
            setState({ ...s });
            if (s.phase === "over") {
              setAnnounce(
                `Run over. ${s.score} points${s.newBest ? ", a new best" : `, best ${s.best}`}.`,
              );
            } else if (s.phase === "running") {
              setAnnounce("");
            }
          },
        });
        gameRef.current = handle;
        setState(handle.getState());
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });

    return () => {
      cancelled = true;
      handle?.destroy();
      gameRef.current = null;
    };
  }, []);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const phase = g.getState().phase;
    if (phase === "title") g.start();
    else if (phase === "over") g.restart();
    else if (phase === "paused") g.resume();
    else g.jump();
  }, []);
  const duck = useCallback((down: boolean) => gameRef.current?.duck(down), []);

  const share = useCallback(async () => {
    const s = gameRef.current?.getState();
    if (!s || typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "Bucket Run",
        text: `I ran ${s.score} on Bucket Run. ${SITE}`,
        url: `https://${SITE}`,
      });
    } catch {
      // The user closed the share sheet; nothing to do.
    }
  }, []);

  const over = state?.phase === "over";

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative h-[clamp(300px,52dvh,480px)] w-full overflow-hidden bg-ink sm:h-[clamp(360px,62vh,720px)]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none"
          role="img"
          aria-label="Bucket Run. The detailer runs the forecourt at night. Press space or tap to jump, down arrow to duck."
        />
        {status === "missing" ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-bone/60">
            The street is not open yet. Try again in a moment.
          </p>
        ) : null}
      </div>

      <div className="hairline flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t py-4 text-sm tabular-nums sm:pr-24">
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div className="flex items-baseline gap-2">
            <dt className="text-bone/50">Score</dt>
            <dd className="font-display text-lg font-semibold">{state?.score ?? 0}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-bone/50">Best</dt>
            <dd className={cn("font-display text-lg font-semibold", state?.newBest && "text-accent")}>
              {state?.best ?? 0}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-bone/50">Cans</dt>
            <dd className="font-display text-lg font-semibold">{state?.cans ?? 0}</dd>
          </div>
          {state?.neighbourhood ? (
            <div className="flex items-baseline gap-2">
              <dt className="sr-only">Neighbourhood</dt>
              <dd className="text-bone/70">{state.neighbourhood}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={jump}
            disabled={status !== "ready"}
            className="hairline text-bone hover:border-accent hover:text-accent inline-flex h-10 items-center border px-4 font-medium transition-colors disabled:opacity-40"
          >
            {over ? "Run again" : state?.phase === "title" ? "Run" : "Jump"}
          </button>
          <button
            type="button"
            onPointerDown={() => duck(true)}
            onPointerUp={() => duck(false)}
            onPointerLeave={() => duck(false)}
            onPointerCancel={() => duck(false)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                duck(true);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") duck(false);
            }}
            disabled={status !== "ready" || state?.phase !== "running"}
            className="hairline text-bone hover:border-accent hover:text-accent inline-flex h-10 items-center border px-4 font-medium transition-colors disabled:opacity-40"
          >
            Duck
          </button>
          {canShare && over ? (
            <button
              type="button"
              onClick={share}
              className="text-bone/70 hover:text-accent inline-flex h-10 items-center gap-2 px-2 transition-colors"
            >
              <ShareNetwork size={18} aria-hidden="true" />
              Share
            </button>
          ) : null}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
