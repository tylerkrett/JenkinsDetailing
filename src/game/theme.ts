/** The game runs on the site's five colours. Blue is only ever bottles and score flashes. */
export const COLOR = {
  ink: "#06080f",
  ink2: "#0c111c",
  bone: "#eef1f6",
  accent: "#2247d6",
  accentLit: "#8fa6ff",
} as const;

/** Bone at an alpha, for lines and tints; keeps every mid tone derived from the palette. */
export function bone(alpha: number) {
  return `rgba(238, 241, 246, ${alpha})`;
}
export function ink(alpha: number) {
  return `rgba(6, 8, 15, ${alpha})`;
}
export function jade(alpha: number) {
  return `rgba(34, 71, 214, ${alpha})`;
}

export const FONT_DISPLAY_FALLBACK = `Archivo, ui-sans-serif, system-ui, sans-serif`;
export const FONT_BODY_FALLBACK = `Figtree, ui-sans-serif, system-ui, sans-serif`;

/** Logical layout: the world is drawn in these units and scaled to the canvas. */
export const VIEW = {
  /** Minimum logical width so a phone still sees enough road ahead. */
  minWidth: 640,
  /** Reference logical height; taller boxes get more sky, never less road. */
  height: 360,
  /** Logical width used on narrow or portrait boxes: bigger world, a touch less warning. */
  narrowWidth: 360,
  /** Where the cat stands, from the left edge. */
  playerX: 88,
  playerXNarrow: 60,
  /** Pavement band from the ground line to the kerb line. */
  kerb: 22,
} as const;
