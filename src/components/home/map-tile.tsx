import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

import type { SiteSettings } from "~/lib/content";

/** A drawn map tile of the unit that opens directions. Renders nothing without a directions link. */
export function MapTile({ settings: s }: { settings: SiteSettings }) {
  if (!s.directionsUrl) return null;
  return (
    <a className="map-tile group" href={s.directionsUrl} target="_blank" rel="noreferrer">
      <div aria-hidden="true" className="map-roads">
        <span className="map-pin">J</span>
      </div>
      <p className="eyebrow">Find us</p>
      <p className="group-hover:text-accent-lit mt-3 flex items-center gap-2 text-2xl font-semibold transition-colors">
        {s.addressLine}
        <ArrowUpRight size={20} aria-hidden="true" />
      </p>
      <p className="text-bone/70 mt-1 text-sm">
        {s.town} {s.postcode}
      </p>
      <p className="text-bone/80 mt-3 text-sm">Directions in Google Maps (opens in a new tab)</p>
    </a>
  );
}
