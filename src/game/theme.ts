/**
 * The game's palette: Rose Garage at night, as in the 3D bay. The site's ink, bone and
 * Jenkins blue, plus slate, stone, lamp light and cone orange for the world. Blue is kept
 * for the bucket and the bottles, so anything blue is good to touch.
 */
export const COLOR = {
  ink: "#06080f",
  ink2: "#0c111c",
  bone: "#eef1f6",
  accent: "#2247d6",
  accentLit: "#8fa6ff",
  skyTop: "#04060c",
  skyLow: "#1f2d55",
  hillFar: "#172240",
  hillNear: "#0e162c",
  trees: "#080c17",
  wall: "#1b2232",
  wallSeam: "#212a3c",
  coping: "#2c3548",
  plinth: "#121826",
  door: "#353e52",
  doorSlat: "#2a3243",
  stone: "#3d4354",
  slate: "#161c29",
  kerb: "#1a2130",
  tarmac: "#0b0f17",
  steel: "#aab3c4",
  tyre: "#4a5163",
  tyreSide: "#8a93a6",
  lamp: "#ffd79c",
  cone: "#ff7a3d",
} as const;

/** Bone at an alpha, for lines and tints; keeps every mid tone derived from the palette. */
export function bone(alpha: number) {
  return `rgba(238, 241, 246, ${alpha})`;
}
export function ink(alpha: number) {
  return `rgba(6, 8, 15, ${alpha})`;
}
export function lamp(alpha: number) {
  return `rgba(255, 215, 156, ${alpha})`;
}
export function blue(alpha: number) {
  return `rgba(143, 166, 255, ${alpha})`;
}

export const FONT_DISPLAY_FALLBACK = `Archivo, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
export const FONT_BODY_FALLBACK = `Figtree, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Logical layout: the world is drawn in these units and scaled to the canvas. */
export const VIEW = {
  /** Minimum logical width so a phone still sees enough road ahead. */
  minWidth: 640,
  /** Reference logical height; taller boxes get more sky, never less road. */
  height: 360,
  /** Logical width used on narrow or portrait boxes: bigger world, a touch less warning. */
  narrowWidth: 360,
  /** Where the bucket stands, from the left edge. */
  playerX: 88,
  playerXNarrow: 60,
  /** Forecourt paving band from the ground line to the kerb line. */
  kerb: 22,
} as const;
