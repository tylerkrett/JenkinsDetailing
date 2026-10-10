import { Eyebrow } from "~/components/ui/section-header";
import type { Service, SiteSettings } from "~/lib/content";
import { lines, telHref } from "~/lib/format";

import { MapTile } from "./map-tile";
import { QuoteActions } from "./quote-actions";

type Props = { settings: SiteSettings; services: Pick<Service, "slug" | "title">[] };

/** Address, hours, phone, the map and the two ways to ask. Closes the home page. */
export function ContactBlock({ settings: s, services }: Props) {
  return (
    <section aria-labelledby="find-us" className="site-container section-space">
      <div data-reveal className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <Eyebrow>Get a quote</Eyebrow>
          <h2 id="find-us" className="font-display text-display-lg mt-4 font-bold tracking-tight">
            Let’s talk about your car.
          </h2>
          <address className="text-bone/80 mt-6 not-italic">
            {s.addressLine}
            <br />
            {s.town} {s.postcode}
          </address>
          <p className="text-bone/80 mt-6">
            {lines(s.hoursText).map((l, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {l}
              </span>
            ))}
          </p>
          <p className="mt-6">
            <a href={telHref(s.phoneDigits)} className="font-display text-display-md font-bold tabular-nums">
              {s.phone}
            </a>
          </p>
        </div>
        <div className="mt-10 lg:col-span-6 lg:col-start-7 lg:mt-0">
          <p className="text-bone/80 max-w-[48ch]">
            Tell us the car and what it needs. We reply with a price and the earliest date. For the fastest answer,
            send photos on WhatsApp.
          </p>
          <QuoteActions services={services} settings={s} className="mt-8" />
          <p className="text-bone/60 mt-5 text-sm">{s.replyPromise}</p>
          <div className="mt-10">
            <MapTile settings={s} />
          </div>
        </div>
      </div>
    </section>
  );
}
