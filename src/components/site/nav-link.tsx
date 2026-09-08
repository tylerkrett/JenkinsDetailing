"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href" | "aria-current"> & { href: string };

/**
 * A primary navigation link that knows when it is the current page. Home matches only
 * on `/`; every other link also claims the routes beneath it, so the Gallery link is
 * current on a painting and the Street link on a wall.
 */
export function NavLink({ href, ...rest }: Props) {
  const pathname = usePathname();
  const current = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={current ? "page" : undefined} {...rest} />;
}
