import models from "../../../content/models.generated.json";

import { whenWarm } from "./warm";

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

type Download = { fraction: number; listeners: Set<(fraction: number) => void>; done: Promise<void> };
const downloads = new Map<string, Download>();

/**
 * Downloads a file with byte-level progress, once, and leaves it in the HTTP cache, so the
 * glTF loader that follows finds it locally. Content-Length is known because the files are
 * static assets with immutable caching. A second caller joins the download in flight.
 */
function download(url: string): Download {
  const existing = downloads.get(url);
  if (existing) return existing;
  const entry: Download = { fraction: 0, listeners: new Set(), done: Promise.resolve() };
  const publish = (fraction: number) => {
    entry.fraction = fraction;
    for (const listener of entry.listeners) listener(fraction);
  };
  entry.done = (async () => {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (total > 0) publish(received / total);
    }
    publish(1);
  })();
  // A failed download can be tried again by the next caller.
  entry.done.catch(() => downloads.delete(url));
  downloads.set(url, entry);
  return entry;
}

function fetchWithProgress(url: string): Loader {
  return async (report) => {
    const d = download(url);
    report(d.fraction);
    d.listeners.add(report);
    try {
      await d.done;
    } finally {
      d.listeners.delete(report);
    }
    report(1);
  };
}

/**
 * Starts the car downloading the moment the 3D view is chosen, alongside the code that
 * will draw it, rather than after that code has arrived and mounted. The preloader joins
 * the same download, so its percentage stays true.
 */
export function prefetchCar(mobile: boolean) {
  download(carModelUrl(mobile)).done.catch(() => undefined);
}

/** The scene readying its shaders and textures (see components/scene/warmup.tsx). */
const warmedUp: Loader = (report) => whenWarm().then(() => report(1));

/** The loaders the preloader gates on for the bay: the car, then the compile. */
export function bayLoaders(mobile: boolean): Loader[] {
  return [fetchWithProgress(carModelUrl(mobile)), warmedUp];
}
