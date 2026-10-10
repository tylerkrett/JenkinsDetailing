"use client";

import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  ArrowsIn,
  ArrowsOut,
  CheckCircle,
  Pause,
  Play,
  ShareNetwork,
} from "@phosphor-icons/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CreateGame, GameHandle, GamePhase, GameState } from "~/game/types";

import styles from "./play.module.css";

const SITE = "jenkinsdetailing.com/play";
const fmt = new Intl.NumberFormat("en-GB");

type Status = "loading" | "ready" | "missing";

/**
 * Bucket Run on the site: the canvas, the cards between runs and the controls. The engine
 * (src/game) runs the game and draws the HUD itself; React only hears about phase changes,
 * so nothing here renders while a run is going. Jump and Duck act on press, not on release,
 * and a held Jump rises higher.
 */
export function BucketRun() {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const copiedTimer = useRef(0);
  const [status, setStatus] = useState<Status>("loading");
  const [phase, setPhase] = useState<GamePhase>("title");
  const [result, setResult] = useState<GameState | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: GameHandle | null = null;
    let current: GamePhase = "title";
    setCanShare(typeof navigator.share === "function" || typeof navigator.clipboard?.writeText === "function");

    import("~/game/engine")
      .then((mod: { createGame?: CreateGame; default?: CreateGame }) => {
        if (cancelled) return;
        const create = mod.createGame ?? mod.default;
        if (typeof create !== "function") {
          setStatus("missing");
          return;
        }
        handle = create(canvas, {
          cards: false,
          onState: (s) => {
            // Only phase changes reach React. The score lives on the canvas.
            if (s.phase === current) return;
            const was = current;
            current = s.phase;
            setPhase(s.phase);
            setResult(s);
            if (s.phase === "over") {
              setAnnounce(`Run over: ${fmt.format(s.score)} points${s.newBest ? ", a new best" : ""}.`);
            } else if (s.phase === "paused") {
              setAnnounce("Paused.");
            } else if (s.phase === "running") {
              setAnnounce(was === "paused" ? "Running again." : "Run started.");
            }
          },
        });
        gameRef.current = handle;
        const s = handle.getState();
        current = s.phase;
        setPhase(s.phase);
        setResult(s);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(copiedTimer.current);
      handle?.destroy();
      gameRef.current = null;
    };
  }, []);

  // A run keeps focus on the canvas, so Space and P go to the game. Focus is never moved to
  // Play again: a Space held through the crash would release onto it and skip the restart
  // pause the engine keeps.
  useEffect(() => {
    if (status !== "ready" || phase !== "running") return;
    // Only when focus would otherwise be lost, i.e. the Play button that had it is gone.
    if (!document.activeElement || document.activeElement === document.body) {
      canvasRef.current?.focus({ preventScroll: true });
    }
  }, [phase, status]);

  const primary = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    if (game.getState().phase === "paused") game.resume();
    else game.start();
  }, []);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    if (game.getState().phase === "paused") game.resume();
    else game.pause();
  }, []);

  /** Pointer and key handlers for a button held like a game control. */
  const holdable = (down: () => void, up: () => void) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      try {
        // Keep the release coming here even if the thumb slides off the button.
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the press still counts.
      }
      e.currentTarget.dataset.held = "";
      down();
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      delete e.currentTarget.dataset.held;
      up();
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
      delete e.currentTarget.dataset.held;
      up();
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (!e.repeat) down();
    },
    onKeyUp: (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      up();
    },
    onBlur: up,
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });

  const jumpControls = holdable(
    () => gameRef.current?.press(),
    () => gameRef.current?.release(),
  );
  const duckControls = holdable(
    () => gameRef.current?.duck(true),
    () => gameRef.current?.duck(false),
  );

  const toggleImmersive = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (immersive) {
      setImmersive(false);
      return;
    }
    setImmersive(true);
    // Real full screen where the browser allows it; elsewhere (iPhone) the stage covers the page.
    if (typeof shell.requestFullscreen === "function") {
      void shell.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
    }
  }, [immersive]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // While the stage covers the page, the page behind must not scroll, and Escape leaves.
  useEffect(() => {
    if (!immersive) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [immersive]);

  const share = useCallback(async () => {
    const s = gameRef.current?.getState();
    if (!s) return;
    const text = `I scored ${fmt.format(s.score)} on Bucket Run, the Jenkins Detailing game.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Bucket Run", text, url: `https://${SITE}` });
      } catch {
        // The share sheet was closed; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} https://${SITE}`);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard blocked; the button simply does nothing.
    }
  }, []);

  const ready = status === "ready";
  const running = ready && phase === "running";
  const best = result?.best ?? 0;

  return (
    <div
      ref={shellRef}
      className={styles.shell}
      data-immersive={immersive ? "" : undefined}
      data-phase={ready ? phase : status}
      data-bucket-run=""
    >
      <div className={styles.frame}>
        <div className={styles.stage}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            tabIndex={0}
            role="img"
            aria-label="Bucket Run. A wash bucket runs the forecourt of Rose Garage at night. Space or a tap jumps, the down arrow or a swipe down ducks, P pauses."
          />
          {running ? null : (
            <div className={styles.overlay}>
              <div className={styles.card}>
                {status === "loading" ? <p className={styles.loading}>Loading the game</p> : null}

                {status === "missing" ? (
                  <>
                    <p className={styles.title}>The game didn’t load.</p>
                    <p className={styles.lede}>Check your connection, then reload the page.</p>
                    <button type="button" className={styles.play} onClick={() => window.location.reload()}>
                      <ArrowCounterClockwise size={20} weight="bold" aria-hidden="true" />
                      Reload
                    </button>
                  </>
                ) : null}

                {ready && phase === "title" ? (
                  <>
                    <p className={styles.wordmark}>Bucket Run</p>
                    <p className={styles.lede}>
                      The night shift at Rose Garage. Jump the cones, duck the red kites and grab every bottle you can.
                    </p>
                    <button type="button" className={styles.play} onClick={primary}>
                      <Play size={20} weight="fill" aria-hidden="true" />
                      Play
                    </button>
                    <p className={styles.hint}>
                      <span className={styles.fine}>
                        or press <kbd>Space</kbd>
                      </span>
                      <span className={styles.coarse}>or tap anywhere on the game</span>
                    </p>
                    {best > 0 ? <p className={styles.best}>Your best: {fmt.format(best)}</p> : null}
                  </>
                ) : null}

                {ready && phase === "paused" ? (
                  <>
                    <p className={styles.title}>Paused</p>
                    <button type="button" className={styles.play} onClick={primary}>
                      <Play size={20} weight="fill" aria-hidden="true" />
                      Resume
                    </button>
                    <p className={styles.hint}>
                      <span className={styles.fine}>
                        or press <kbd>P</kbd>
                      </span>
                      <span className={styles.coarse}>or tap anywhere on the game</span>
                    </p>
                  </>
                ) : null}

                {ready && phase === "over" && result ? (
                  <>
                    <p className={styles.kicker}>{result.newBest ? "New best" : "Run over"}</p>
                    <p className={styles.score}>
                      {fmt.format(result.score)}
                      <span>points</span>
                    </p>
                    <p className={styles.stats}>
                      {result.bottles} {result.bottles === 1 ? "bottle" : "bottles"} collected
                      {result.newBest ? "" : `, best ${fmt.format(result.best)}`}
                    </p>
                    <div className={styles.actions}>
                      <button type="button" className={styles.play} onClick={primary}>
                        <ArrowCounterClockwise size={20} weight="bold" aria-hidden="true" />
                        Play again
                      </button>
                      {canShare ? (
                        <button type="button" className={styles.secondary} onClick={share}>
                          {copied ? (
                            <CheckCircle size={20} aria-hidden="true" />
                          ) : (
                            <ShareNetwork size={20} aria-hidden="true" />
                          )}
                          {copied ? "Copied" : "Share score"}
                        </button>
                      ) : null}
                    </div>
                    <p className={styles.hint}>
                      <span className={styles.fine}>
                        or press <kbd>Space</kbd>
                      </span>
                      <span className={styles.coarse}>or tap anywhere on the game</span>
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className={styles.dock}>
          <p className={styles.keys}>
            <span>
              <kbd>Space</kbd> Jump
            </span>
            <span>
              <kbd>↓</kbd> Duck
            </span>
            <span>
              <kbd>P</kbd> Pause
            </span>
          </p>
          <button type="button" className={styles.duck} disabled={!ready} {...duckControls}>
            <ArrowDown size={24} weight="bold" aria-hidden="true" />
            Duck
          </button>
          <div className={styles.tools}>
            <button
              type="button"
              className={styles.tool}
              onClick={togglePause}
              disabled={!ready || (phase !== "running" && phase !== "paused")}
            >
              {phase === "paused" ? (
                <Play size={18} weight="fill" aria-hidden="true" />
              ) : (
                <Pause size={18} weight="fill" aria-hidden="true" />
              )}
              <span className={styles.toolLabel}>{phase === "paused" ? "Resume" : "Pause"}</span>
            </button>
            <button type="button" className={styles.tool} onClick={toggleImmersive} aria-pressed={immersive}>
              {immersive ? (
                <ArrowsIn size={18} weight="bold" aria-hidden="true" />
              ) : (
                <ArrowsOut size={18} weight="bold" aria-hidden="true" />
              )}
              <span className={styles.toolLabel}>Full screen</span>
            </button>
          </div>
          <button type="button" className={styles.jump} disabled={!ready} {...jumpControls}>
            <ArrowUp size={24} weight="bold" aria-hidden="true" />
            Jump
          </button>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
