/** Best score and play count in localStorage, silent when storage is blocked or full. */
export type GameStorage = {
  readBest(): number;
  writeBest(value: number): void;
  readPlays(): number;
  writePlays(value: number): void;
};

export function createStorage(prefix = "jd:play"): GameStorage {
  const read = (key: string) => {
    try {
      const raw = globalThis.localStorage?.getItem(`${prefix}:${key}`);
      const n = raw == null ? 0 : Number(raw);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  };
  const write = (key: string, value: number) => {
    try {
      globalThis.localStorage?.setItem(`${prefix}:${key}`, String(Math.floor(value)));
    } catch {
      // Private mode or quota: the session keeps its own copy in the engine.
    }
  };
  return {
    readBest: () => read("best"),
    writeBest: (v) => write("best", v),
    readPlays: () => read("plays"),
    writePlays: (v) => write("plays", v),
  };
}
