import type { SceneMode } from "./store";

/** Which world the persistent canvas shows for a given route. */
export function modeForPath(pathname: string): SceneMode {
  if (pathname === "/") return "bay";
  // The finished car sits behind the story, dimmed.
  if (pathname === "/about") return "alcove";
  // The game draws on its own 2D canvas; two render loops would fight for the GPU.
  if (pathname === "/play") return "off";
  if (pathname === "/contact" || pathname === "/privacy" || pathname === "/terms") return "off";
  if (pathname.startsWith("/services/") || pathname.startsWith("/work/")) return "off";
  return "void";
}
