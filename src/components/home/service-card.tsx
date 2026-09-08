import Link from "next/link";

import { Photo } from "~/components/site/photo";
import type { Service } from "~/lib/content";
import { fromPrice } from "~/lib/format";

const SIZES = "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, calc(100vw - 3rem)";

/** One service in a list: photo when there is one, title, the one line, the from price. */
export function ServiceCard({ service }: { service: Service }) {
  const price = fromPrice(service.fromPriceGBP);
  return (
    <Link
      href={`/services/${service.slug}`}
      className="group hairline flex flex-col gap-4 border-t pt-5 transition-colors duration-200"
    >
      {service.image ? (
        <div className="overflow-hidden">
          <Photo
            image={service.image}
            alt=""
            sizes={SIZES}
            className="ease-out-quint aspect-[4/3] transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-display-md group-hover:text-accent-lit font-bold tracking-tight transition-colors">
          {service.title}
        </h3>
        <p className="text-bone/70">{service.promise}</p>
        <p className="text-bone/50 text-sm">
          {price ?? "Priced on inspection"}
          {service.mobile ? " · At the unit or at your door" : ""}
        </p>
      </div>
    </Link>
  );
}
