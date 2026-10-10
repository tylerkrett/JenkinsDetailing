"use client";

import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

/** The header's backdrop: a soft gradient over the hero, frosted ink after 80 px of scroll. */
export function HeaderSurface() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 80);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <div aria-hidden="true" className={cn("header-surface", scrolled && "is-scrolled")} />;
}
