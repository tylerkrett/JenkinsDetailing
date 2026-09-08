"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A quiet bar along the bottom edge while the connection is down: the site keeps whatever
 * is already on screen, and the visitor is pointed at the game, which the service worker
 * can serve without a network. Not shown on the game page itself.
 */
export function OfflineNotice() {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline || pathname === "/play") return null;
  return (
    <div
      role="status"
      className="bg-ink-2 border-accent/60 fixed inset-x-0 bottom-0 z-30 border-t px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <p className="text-bone/70">No signal. Too street for the network.</p>
        <Link
          href="/play"
          className="text-bone decoration-accent/60 hover:decoration-accent underline underline-offset-[6px] transition-colors"
        >
          Play while you wait
        </Link>
      </div>
    </div>
  );
}
