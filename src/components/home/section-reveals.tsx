"use client";

import { useEffect } from "react";

/**
 * Fades each `[data-reveal]` block in as it scrolls into view: 500 ms on the out-quint
 * ease with 16 px of travel. Anything already on screen at load is left alone, nothing
 * moves under reduced motion, and without JavaScript everything is simply visible.
 */
export function SectionReveals() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const running = new Set<Animation>();
    const pending = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.style.opacity = "";
          const animation = el.animate(
            [
              { opacity: 0, transform: "translateY(16px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
          running.add(animation);
          animation.onfinish = () => running.delete(animation);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of pending) {
      el.style.opacity = "0";
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      for (const a of running) a.cancel();
      for (const el of pending) el.style.opacity = "";
    };
  }, []);
  return null;
}
