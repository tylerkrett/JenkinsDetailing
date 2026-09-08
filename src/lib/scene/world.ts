import type { SceneMode } from "./store";

/**
 * What every world on the persistent canvas agrees to. The scroll driver, camera rig,
 * caption, index and keyboard nav only ever talk to this, so a new world is a new
 * layout module and a set of meshes, never a change to the plumbing. Everything is a
 * pure function of scroll progress so scrubbing is exact.
 */

export type Vec3 = readonly [number, number, number];

export type CameraPose = {
  position: Vec3;
  /** What the camera looks at. */
  target: Vec3;
  /** Vertical field of view in degrees; the rig's base when omitted. */
  fov?: number;
};

export type WorldLayout = {
  /** The scene mode this layout belongs to; the layout is live only while it matches. */
  readonly kind: SceneMode;
  readonly stationCount: number;
  /** Total scroll in world units: the camera path plus every dwell. */
  readonly totalTravel: number;
  /** Camera pose at rest for a 0..1 progress. */
  pose(progress: number, aspect: number): CameraPose;
  /** Scroll progress at which a station's dwell begins: the camera is exactly at its hold. */
  holdProgress(index: number): number;
  /** Index of the station nearest a 0..1 progress. */
  nearestStation(progress: number): number;
  /** Fraction of a station's scroll spent standing still; the snap leaves that alone. */
  readonly plateau: number;
  /** Units of travel for the DOM spacers: before the first hold, per station, after the last. */
  readonly spans: { threshold: number; station: number; outro: number };
  /**
   * Where a touch swipe can land, as ascending 0..1 progress values. Defaults to the
   * hold starts; a world whose dwell is a process can add the dwell ends too.
   */
  slots?(): number[];
  /** How long a committed swipe takes to arrive. */
  readonly swipeSeconds?: number;
};

/** Progress values a swipe can land on: the world's own list, else its hold starts. */
export function worldSlots(world: WorldLayout): number[] {
  if (world.slots) return world.slots();
  return Array.from({ length: world.stationCount }, (_, i) => world.holdProgress(i));
}
