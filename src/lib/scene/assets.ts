import models from "../../../content/models.generated.json";

/**
 * What the preloader waits for before the bay is revealed. Each loader reports a 0..1
 * fraction as it goes; the preloader shows the weighted average as a real percentage.
 */
export type Loader = (report: (fraction: number) => void) => Promise<unknown>;

type ModelManifest = Record<"desktop" | "mobile", { src: string; bytes: number }>;
const manifest: ModelManifest = models;

/** The car model for this device. Phones get the smaller variant; desktops the full one. */
export function carModelUrl(mobile: boolean) {
  return (mobile ? manifest.mobile : manifest.desktop).src;
}

/**
 * Fetches a file with byte-level progress and leaves it in the HTTP cache, so the glTF
 * loader that follows finds it locally. Content-Length is known because the files are
 * static assets with immutable caching.
 */
function fetchWithProgress(url: string): Loader {
  return async (report) => {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (total > 0) report(received / total);
    }
    report(1);
  };
}

/** The loaders the preloader gates on for the bay. */
export function bayLoaders(mobile: boolean): Loader[] {
  return [fetchWithProgress(carModelUrl(mobile))];
}
