"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that serves the offline shell (the Bucket Run game) when a
 * page cannot be reached. Production only: next dev does not serve public/sw.js reliably
 * and a worker caching dev chunks makes hot reload lie.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((r) => {
          registration = r;
        })
        .catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
