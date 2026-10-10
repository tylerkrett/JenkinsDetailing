/// <reference lib="webworker" />
/**
 * Jenkins Detailing service worker. Hand written, no workbox: one job is to hand back the offline
 * shell (the Bucket Run game) when a navigation cannot reach the network, the rest is a
 * light cache for the static files the site already marks long-lived.
 *
 * Built by scripts/build-game.ts into public/sw.js with __VERSION__ set to a hash of the
 * offline shell and this source, so a deploy that changes either installs a fresh worker and
 * drops the old shell cache on activate; unchanged deploys keep their caches.
 *
 * No HTML is ever cached: navigations always go to the network and the shell is only used
 * when the fetch itself fails (the Chrome dino model), never on a slow response.
 *
 * Kill switch: if this worker ever has to go, do not delete the file (installed workers keep
 * running until an update check finds a new script). Ship a sw.js that calls skipWaiting in
 * install and, in activate, deletes every jd-* cache, calls registration.unregister()
 * and reloads clients.
 */
declare const self: ServiceWorkerGlobalScope;
declare const __VERSION__: string;

const VERSION = __VERSION__;
const SHELL_CACHE = `jd-shell-${VERSION}`;
// The static cache is not versioned: _next/static URLs are content hashed, so entries from
// the previous deploy can still serve a tab that loaded before it and are simply trimmed.
const STATIC_CACHE = "jd-static";
const STATIC_LIMIT = 120;
const PHOTO_CACHE = "jd-art";
const ART_LIMIT = 40;
const OFFLINE_URL = "/offline.html";

const STATIC_PREFIXES = ["/_next/static/", "/brand/", "/icons/", "/models/", "/decoders/"];
const SKIP_PREFIXES = ["/admin", "/api", "/cms-auth"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Cloudflare's asset handling may answer /offline.html with a redirect to /offline;
      // store a clean 200 under the canonical key whichever path served it.
      const response = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
      if (!response.ok) throw new Error(`offline shell ${response.status}`);
      const html = await response.text();
      await cache.put(
        OFFLINE_URL,
        new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("jd-") &&
              key !== SHELL_CACHE &&
              key !== STATIC_CACHE &&
              key !== PHOTO_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data: unknown = event.data;
  if (data && typeof data === "object" && (data as { type?: unknown }).type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const { pathname } = url;
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
  if (pathname === "/sw.js" || pathname === OFFLINE_URL) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (pathname.startsWith("/photos-derived/")) {
    event.respondWith(artCacheFirst(request));
  }
});

/**
 * Network always; the offline shell only when the fetch itself rejects. No timeout: a slow
 * page on a slow connection is still the page, and a shell served to an online visitor
 * would be a bug, not a feature. The request goes through untouched so redirects and the
 * navigate mode behave exactly as without a worker.
 */
async function navigate(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const shell = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
    if (shell) return shell;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone()).then(() => trim(cache, STATIC_LIMIT));
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    void network;
    return cached;
  }
  const fresh = await network;
  return fresh ?? new Response("", { status: 504 });
}

async function artCacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(PHOTO_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      void trim(cache, ART_LIMIT);
    }
    return response;
  } catch {
    return new Response("", { status: 504 });
  }
}

/** Keeps the runtime cache from hoarding a whole gallery: oldest entries go first. */
async function trim(cache: Cache, limit: number) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

export {};
