import { cn } from "~/lib/cn";
import type { ProcessedImage } from "~/lib/content";

type Props = {
  image: ProcessedImage;
  alt: string;
  /** The `sizes` attribute: how wide the image renders at each breakpoint. */
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * A processed photo: the WebP ladder as a srcset, the tiny LQIP as the background while
 * it decodes, and intrinsic size so the layout never shifts. No optimiser runs on
 * Workers, so this is a plain img.
 */
export function Photo({ image, alt, sizes, priority = false, className }: Props) {
  const largest = image.sizes[image.sizes.length - 1]!;
  const srcSet = image.sizes.map((s) => `${s.src} ${s.width}w`).join(", ");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static asset, no optimiser on Workers
    <img
      src={largest.src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={{ backgroundImage: `url(${image.lqip})`, backgroundSize: "cover", backgroundColor: image.dominantColor }}
      className={cn("block h-auto w-full object-cover", className)}
    />
  );
}
