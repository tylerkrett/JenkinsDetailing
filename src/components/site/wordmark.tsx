import Link from "next/link";

import { cn } from "~/lib/cn";

import { Mark } from "./mark";

/** The mark as the home link, in the header and the footer. */
export function Wordmark({ className, markClassName = "h-8" }: { className?: string; markClassName?: string }) {
  return (
    <Link
      href="/"
      aria-label="Jenkins Detailing home"
      className={cn("inline-block transition-opacity duration-200 hover:opacity-80", className)}
    >
      <Mark className={markClassName} alt="" />
    </Link>
  );
}
