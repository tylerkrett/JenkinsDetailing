"use client";

import { useEffect, useState } from "react";

import { Mark } from "~/components/site/mark";
import { cn } from "~/lib/cn";
import { detectSceneSupport } from "~/lib/scene/capabilities";
import { useScene } from "~/lib/scene/store";

/**
 * The first paint. Server-rendered so the very first frame is the loading screen, in
 * the same dress as the real preloader. It decides for itself whether the scene can
 * run: if it can, the cover stays until the scene is actually active and the preloader
 * is on screen in its place; if it cannot, the cover lifts to reveal the static page.
 * Without JavaScript a CSS timer lifts it on its own.
 */
export function LoadCover() {
  const active = useScene((s) => s.active);
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(detectSceneSupport().ok), []);

  if (active) return null;
  if (supported === false) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "load-cover bg-ink fixed inset-0 z-30 flex flex-col items-center justify-center gap-6",
        supported === true && "load-cover-hold",
      )}
    >
      <Mark className="h-14 w-auto sm:h-16" />
    </div>
  );
}
