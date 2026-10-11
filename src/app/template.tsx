"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { resetScroll } from "~/lib/scene/lenis";

/** Set once the first page has hydrated; only later navigations fade in. */
let hydrated = false;

/**
 * Re-mounts on every navigation so the incoming page runs its arrival animation. The
 * first page of a visit paints straight away: fading it in from nothing would only delay
 * the hero, and browsers do not count content first painted invisible as its largest
 * paint. Under reduced motion the global rule collapses the fade to a plain cut. It must
 * stay free of scene imports: it wraps every page, and only /watch may load three.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [arrive] = useState(() => hydrated);
  useEffect(() => {
    hydrated = true;
  }, []);
  // Every navigation starts at the top, whatever the smooth-scroll state was before.
  useEffect(() => {
    // The site manages its own scroll; a reload must not reopen halfway down the corridor.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const go = () => {
      if (!window.location.hash) resetScroll();
    };
    go();
    // bfcache restores the whole page, including a finished car; pageshow is the hook.
    window.addEventListener("pageshow", go);
    return () => window.removeEventListener("pageshow", go);
  }, [pathname]);
  return (
    <div key={pathname} className={arrive ? "page-arrive" : undefined}>
      {children}
    </div>
  );
}
