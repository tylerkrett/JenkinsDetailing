import { cn } from "~/lib/cn";

/**
 * The Jenkins script mark. A raster for now (the logo as supplied); swap the source for
 * the traced SVG when it arrives. Sized by height so it sits on any line.
 */
export function Mark({ className, alt = "Jenkins Detailing" }: { className?: string; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimiser on Workers
    <img
      src="/brand/mark.png"
      alt={alt}
      width={184}
      height={90}
      decoding="async"
      className={cn("block w-auto select-none", className)}
    />
  );
}
