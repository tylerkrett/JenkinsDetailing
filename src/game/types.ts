/**
 * Public contract of the Bucket Run engine. Framework free: the engine only needs a canvas.
 * The site wrapper (src/components/game) and the offline shell (src/game/offline.html via
 * scripts/build-game.ts) both drive the game through this interface and nothing else.
 */

export type GamePhase = "title" | "running" | "paused" | "over";

export type GameState = {
  phase: GamePhase;
  /** Distance points plus bottle bonuses, integer. */
  score: number;
  /** Best score from storage (or this session when storage is blocked). */
  best: number;
  /** True once the run beats the previous best; stays true until the next run. */
  newBest: boolean;
  /** Bottles collected this run. */
  bottles: number;
  /** The stretch of the night shift the run has reached, e.g. "Wash bay". */
  stage: string;
  /** Runs finished in this browser, from storage. */
  plays: number;
};

export type GameOptions = {
  /** Deterministic spawner for tests and screenshots. Random when omitted. */
  seed?: number;
  /** Hold the hills and sky still and skip the title screen's drift; the run itself still plays. */
  reducedMotion?: boolean;
  /** Storage key prefix for best score and play count. */
  storageKey?: string;
  /**
   * Called when the phase changes, when the best is beaten, and at most four times a second
   * otherwise. A host that renders with a framework should react to the phase, not to every call.
   */
  onState?: (state: GameState) => void;
  /** The engine attaches its own key, pointer and touch listeners unless this is false. */
  attachInput?: boolean;
  /** Draw the title, pause and run-over cards on the canvas. Off when the host draws its own. Default on. */
  cards?: boolean;
};

export type GameHandle = {
  /** Leave the title card or the run-over card and start running. */
  start(): void;
  pause(): void;
  resume(): void;
  /** Start a fresh run from any phase. */
  restart(): void;
  /** A tap: press and release in one, treated as a full jump. */
  jump(): void;
  /**
   * Press and hold, for on-screen buttons: starts, resumes or jumps on touch-down, and the
   * jump keeps rising until release().
   */
  press(): void;
  release(): void;
  duck(down: boolean): void;
  /** Re-read the canvas box and device pixel ratio. Called automatically on resize. */
  resize(): void;
  getState(): GameState;
  /** Stops the loop and removes every listener. The canvas is left as drawn. */
  destroy(): void;
};

export type CreateGame = (canvas: HTMLCanvasElement, options?: GameOptions) => GameHandle;
