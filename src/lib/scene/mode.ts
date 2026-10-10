import type { SceneMode } from "./store";

/** Which world the canvas shows for a given route. Only /watch has one. */
export function modeForPath(pathname: string): SceneMode {
  return pathname === "/watch" ? "bay" : "off";
}
