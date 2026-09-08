/**
 * Decides whether the 3D scene should mount at all. Performance adaptation after mount
 * is handled by measured frame rate (drei PerformanceMonitor), not by device sniffing.
 */
export type SceneSupport = {
  webgl2: boolean;
  reducedMotion: boolean;
  coarsePointer: boolean;
  /** True when the scene should render. */
  ok: boolean;
};

export function detectSceneSupport(): SceneSupport {
  if (typeof window === "undefined") {
    return { webgl2: false, reducedMotion: true, coarsePointer: false, ok: false };
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  let webgl2 = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    webgl2 = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return { webgl2, reducedMotion, coarsePointer, ok: webgl2 && !reducedMotion };
}
