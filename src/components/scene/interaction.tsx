"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { current } from "~/lib/scene/enter";
import { type SceneMode, useScene } from "~/lib/scene/store";

type Props = {
  /** Where each station leads, by index. */
  hrefs: string[];
  /** The world this belongs to; clicks in any other mode are ignored. */
  mode: SceneMode;
};

/**
 * Click, tap and Enter on the car at a hold go straight to the act's page. Exposes
 * `enterStation` in the store so the caption link and the keyboard handler share it.
 */
export function Interaction({ hrefs, mode: worldMode }: Props) {
  const router = useRouter();
  const active = useScene((s) => s.active);
  const setEnterStation = useScene((s) => s.setEnterStation);

  useEffect(() => {
    if (!active) return;

    const run = () => {
      const { station, ready, mode } = useScene.getState();
      const href = hrefs[station];
      if (!href || !ready || mode !== worldMode) return;
      if (current.index !== station || !current.seated) return;
      router.push(href);
    };

    setEnterStation(run);

    // Warm the current act's page so the click feels instant.
    const unsubscribe = useScene.subscribe((s, prev) => {
      if (s.station === prev.station) return;
      const href = hrefs[s.station];
      if (href) router.prefetch(href);
    });

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const target = e.target as Element | null;
      if (
        target?.closest(
          "a, button, input, textarea, select, [role='dialog'], header, nav",
        )
      )
        return;
      const hit = current.hit;
      if (!hit) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      if (hit(nx, ny)) run();
    };
    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("click", onClick);
      unsubscribe();
      setEnterStation(null);
    };
  }, [active, hrefs, worldMode, router, setEnterStation]);

  return null;
}
