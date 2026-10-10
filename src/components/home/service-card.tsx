import { Photo } from "~/components/site/photo";
import { MediaCard } from "~/components/ui/media-card";
import type { ProcessedImage, Service } from "~/lib/content";
import { fromPrice } from "~/lib/format";

/** Image widths for the grids the card sits in: two across on the home page, three on /services. */
export const CARD_SIZES = {
  two: "(min-width: 1280px) 616px, (min-width: 541px) 48vw, calc(100vw - 3rem)",
  three: "(min-width: 1280px) 392px, (min-width: 1024px) 30vw, (min-width: 541px) 48vw, calc(100vw - 3rem)",
} as const;

type Props = {
  service: Service;
  /** Overrides the service's own photo, so a page never shows the same one twice. */
  image?: ProcessedImage;
  sizes?: string;
  /** Load the photo straight away: for the first cards on screen. */
  priority?: boolean;
  /** h3 under a section title; h2 when the cards sit directly under the page's h1. */
  heading?: "h2" | "h3";
};

/** One service in a grid: photo, title, the one line and the from price. Cards in a row share a height. */
export function ServiceCard({
  service,
  image = service.image,
  sizes = CARD_SIZES.three,
  priority = false,
  heading: Heading = "h3",
}: Props) {
  const price = fromPrice(service.fromPriceGBP);
  return (
    <MediaCard href={`/services/${service.slug}`}>
      {image ? (
        <div className="overflow-hidden">
          <Photo
            image={image}
            alt=""
            sizes={sizes}
            priority={priority}
            className="ease-out-quint aspect-[16/10] transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <Heading className="font-display group-hover:text-accent-lit text-2xl font-bold tracking-tight transition-colors">
          {service.title}
        </Heading>
        <p className="text-bone/70">{service.promise}</p>
        <p className="text-bone/60 mt-auto pt-4 text-sm">
          {price ?? "Priced on inspection"}
          {service.mobile ? " · At the unit or at your door" : ""}
        </p>
      </div>
    </MediaCard>
  );
}
