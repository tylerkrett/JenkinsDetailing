import { create } from "zustand";

import type { WorldLayout } from "./world";

/**
 * Scene state shared between the scroll driver, the world and the DOM chrome.
 * Frame-rate data (progress, velocity) is written by Lenis every frame and read inside
 * useFrame via getState(), never subscribed to by React components, so nothing re-renders
 * on scroll. Coarse state (mode, current station, the active world) is subscribed to
 * normally.
 */

export type SceneMode = "bay" | "off";

type SceneState = {
  /** Which world the camera is in; set by each route. */
  mode: SceneMode;
  /**
   * The layout the camera is following: published by the active world, read by the
   * driver, the rig and the chrome. Null until a world has mounted.
   */
  world: WorldLayout | null;
  /** 0..1 progress through the world, written by the scroll driver each frame. */
  progress: number;
  /** Normalised scroll velocity, 0..1, damped; written each frame. */
  velocity: number;
  /** Index of the station nearest the camera. Coarse; safe to subscribe to. */
  station: number;
  stationCount: number;
  /** Whether WebGL is mounted and rendering. False under reduced motion / no WebGL2. */
  active: boolean;
  /** Whether the preloader has finished. */
  ready: boolean;
  /** True while the click-to-enter sequence runs; scroll and keys are locked. */
  entering: boolean;
  /**
   * Runs the entry sequence for the current station when it is at its hold. Registered
   * by the interaction layer while the scene is active; null otherwise, so callers fall
   * back to a plain navigation.
   */
  enterStation: (() => void) | null;

  setMode: (mode: SceneMode) => void;
  setWorld: (world: WorldLayout | null) => void;
  setFrame: (progress: number, velocity: number) => void;
  setStation: (station: number) => void;
  setStationCount: (n: number) => void;
  setActive: (active: boolean) => void;
  setReady: (ready: boolean) => void;
  setEntering: (entering: boolean) => void;
  setEnterStation: (fn: (() => void) | null) => void;
};

export const useScene = create<SceneState>((set) => ({
  mode: "bay",
  world: null,
  progress: 0,
  velocity: 0,
  station: 0,
  stationCount: 0,
  active: false,
  ready: false,
  entering: false,
  enterStation: null,

  setMode: (mode) => set({ mode }),
  // A world brings its own station count so the index and keyboard nav switch with it.
  setWorld: (world) =>
    set((s) =>
      s.world === world ? s : { world, stationCount: world ? world.stationCount : s.stationCount },
    ),
  setFrame: (progress, velocity) => set({ progress, velocity }),
  setStation: (station) => set((s) => (s.station === station ? s : { station })),
  setStationCount: (stationCount) => set({ stationCount }),
  setActive: (active) => set({ active }),
  setReady: (ready) => set({ ready }),
  setEntering: (entering) => set({ entering }),
  setEnterStation: (enterStation) => set({ enterStation }),
}));

/** The layout to drive, or null when the route's mode has no scrollable world. */
export function activeWorld(s: Pick<SceneState, "mode" | "world">) {
  return s.world?.kind === s.mode ? s.world : null;
}
