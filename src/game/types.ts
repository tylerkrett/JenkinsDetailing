/**
 * Public contract of the Too Street engine. Framework free: the engine only needs a canvas.
 * The site wrapper (src/components/game) and the offline shell (src/game/offline.html via
 * scripts/build-game.ts) both drive the game through this interface and nothing else.
 */

export type GamePhase = "title" | "running" | "paused" | "over";

export type GameState = {
  phase: GamePhase;
  /** Distance points plus can bonuses, integer. */
  score: number;
  /** Best score from storage (or this session when storage is blocked). */
  best: number;
  /** True for the frame the run beat the previous best; stays true until restart. */
  newBest: boolean;
  /** Spray cans collected this run. */
  cans: number;
  /** Current neighbourhood name, chalked on the pavement. */
  neighbourhood: string;
  /** Runs finished in this browser, from storage. */
  plays: number;
};

export type GameOptions = {
  /** Deterministic spawner for tests and screenshots. Random when omitted. */
  seed?: number;
  /** Drop parallax and grain; the game itself still runs (it is user initiated). */
  reducedMotion?: boolean;
  /** Storage key prefix for best score and play count. */
  storageKey?: string;
  /** Called after every state change (phase, score at most a few times a second, best). */
  onState?: (state: GameState) => void;
  /** The engine attaches its own key, pointer and touch listeners unless this is false. */
  attachInput?: boolean;
};

export type GameHandle = {
  /** Leave the title card and start running. No-op unless phase is "title" or "over". */
  start(): void;
  pause(): void;
  resume(): void;
  /** Same as start() from "over": resets the run and goes straight to running. */
  restart(): void;
  /** Programmatic controls, used by the wrapper's accessible buttons. */
  jump(): void;
  duck(down: boolean): void;
  /** Re-read the canvas box and device pixel ratio. Called automatically on window resize. */
  resize(): void;
  getState(): GameState;
  /** Stops the loop and removes every listener. The canvas is left as drawn. */
  destroy(): void;
};

export type CreateGame = (canvas: HTMLCanvasElement, options?: GameOptions) => GameHandle;
