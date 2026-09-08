"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { bindTilt } from "~/lib/scene/pointer";
import { useScene } from "~/lib/scene/store";

const KEY = "jd:tilt";
/** The pill withdraws on its own if ignored; it never returns this session. */
const AUTO_HIDE_MS = 10000;

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Gyroscope parallax for coarse pointers. iOS only grants motion access from a user
 * gesture, so a single pill offers it once the preloader lifts; tapping asks, and on
 * grant device tilt feeds the same parallax path the mouse uses. Declined, errored or
 * ignored: it goes away and stays away for the session. Never nags.
 */
export function TiltPrompt() {
  const ready = useScene((s) => s.ready);
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const unbind = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!ready) return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!coarse || stored || !("DeviceOrientationEvent" in window)) return;
    setShown(true);
  }, [ready]);

  const dismiss = (outcome: "granted" | "declined") => {
    try {
      sessionStorage.setItem(KEY, outcome);
    } catch {
      // Storage may be unavailable; the pill still leaves for this mount.
    }
    setLeaving(true);
  };

  useEffect(() => {
    if (!shown || leaving) return;
    const t = setTimeout(() => dismiss("declined"), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [shown, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setShown(false), 400);
    return () => clearTimeout(t);
  }, [leaving]);

  // The tilt listener outlives the pill and is released with the scene page.
  useEffect(
    () => () => {
      unbind.current?.();
      unbind.current = null;
    },
    [],
  );

  const start = () => {
    unbind.current?.();
    unbind.current = bindTilt();
    dismiss("granted");
  };

  const onTap = async () => {
    const ctor = DeviceOrientationEvent as OrientationCtor;
    if (typeof ctor.requestPermission !== "function") {
      start();
      return;
    }
    try {
      const result = await ctor.requestPermission();
      if (result === "granted") start();
      else dismiss("declined");
    } catch {
      dismiss("declined");
    }
  };

  if (!shown) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(4.75rem+env(safe-area-inset-top))] z-20 flex justify-center">
      <button
        type="button"
        onClick={onTap}
        className={cn(
          "bg-ink/70 text-accent border-bone/15 ease-out-quint pointer-events-auto inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium backdrop-blur transition-[opacity,transform] duration-400",
          leaving ? "translate-y-2 opacity-0" : "caption-in translate-y-0 opacity-100",
        )}
      >
        Tilt to explore
      </button>
    </div>
  );
}
