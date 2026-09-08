import type { ReactNode } from "react";

type Props = { minHeight: string; children: ReactNode };

/**
 * After the last act the camera keeps rising while the DOM takes over: this section
 * gives that stretch its length and holds the rest of the home page.
 */
export function Outro({ minHeight, children }: Props) {
  return (
    <section aria-label="After the reveal" className="relative" style={{ minHeight: `max(100dvh, ${minHeight})` }}>
      {/* An ink scrim so the page reads over the dimmed bay: clear at the top, solid from a third down. */}
      <div aria-hidden="true" className="from-ink/0 via-ink/90 to-ink pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] bg-gradient-to-b" />
      <div aria-hidden="true" className="bg-ink pointer-events-none absolute inset-x-0 top-[60vh] bottom-0 -z-10" />
      {children}
    </section>
  );
}
