"use client";

import { useEffect, useState } from "react";

/**
 * The optional muted loop behind the hero. It only mounts when motion is allowed and the
 * data saver is off; otherwise the hero photo underneath is all anyone sees.
 */
export function HeroVideo({ src }: { src: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const update = () => setEnabled(!motion.matches && !saveData);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);
  if (!enabled) return null;
  return <video src={src} className="hero-video" autoPlay loop muted playsInline aria-hidden="true" />;
}
