import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "~/lib/cn";

type Props = { href: string; children: ReactNode; variant?: "primary" | "outline"; className?: string };

/** A link that looks like a button: the blue primary or the bone outline. */
export function Button({ href, children, variant = "primary", className }: Props) {
  return (
    <Link href={href} className={cn(variant === "primary" ? "button-primary" : "button-outline", "gap-2", className)}>
      {children}
    </Link>
  );
}
