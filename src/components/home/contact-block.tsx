import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

import type { Service, SiteSettings } from "~/lib/content";
import { lines, telHref } from "~/lib/format";

import { QuoteActions } from "./quote-actions";

type Props = { settings: SiteSettings; services: Pick<Service, "slug" | "title">[] };

/** Address, hours, phone and the two ways to ask. Closes the home page and the contact page. */
export function ContactBlock({ settings: s, services }: Props) {
  return (
    <section aria-labelledby="find-us" className="mx-auto max-w-7xl px-6 py-20">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <h2 id="find-us" className="font-display text-display-lg font-bold tracking-tight">
            Find us
          </h2>
          <address className="text-bone/80 mt-6 not-italic">
            {s.addressLine}
            <br />
            {s.town} {s.postcode}
          </address>
          {s.directionsUrl ? (
            <a
              href={s.directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent-lit mt-3 inline-flex items-center gap-1 underline-offset-[6px] hover:underline"
            >
              Directions
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ) : null}
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
        </div>
      </div>
    </section>
  );
}
