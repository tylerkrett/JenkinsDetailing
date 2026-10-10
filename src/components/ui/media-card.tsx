import Link from "next/link";
import type { ReactNode } from "react";

/** A raised card that links on: image on top, copy below, a small lift on hover. */
export function MediaCard({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group media-card">
      {children}
    </Link>
  );
}
