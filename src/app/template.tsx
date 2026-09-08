"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { resetScroll } from "~/components/scene/scroll-driver";

/**
 * Re-mounts on every navigation so the incoming page runs its arrival animation. The
 * persistent canvas underneath does the real transition (a camera move); the DOM only
 * has to arrive. Under reduced motion the global rule collapses this to a plain cut.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Every navigation starts at the top, whatever the smooth-scroll state was before.
  useEffect(() => {
    // The site manages its own scroll; a reload must not reopen halfway down the corridor.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!window.location.hash) resetScroll();
  }, [pathname]);
  return (
    <div key={pathname} className="page-arrive">
      {children}
    </div>
  );
}
