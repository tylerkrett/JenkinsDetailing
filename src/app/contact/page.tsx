import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { QuoteForm } from "~/components/quote/quote-form";
import { JsonLd } from "~/components/site/json-ld";
import { getPages, getService, getServices, getSettings } from "~/lib/content";
import { lines, telHref, whatsappHref } from "~/lib/format";
import { BUSINESS_ID, OG, WEBSITE_ID, absolute, graph, ogImage, pageMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { contact } = await getPages();
  return pageMetadata({
    title: contact.title,
    description: contact.description,
    path: "/contact",
    images: [ogImage(OG.contact, "Get a quote from Jenkins Detailing")],
  });
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const slug = typeof params.service === "string" ? params.service : undefined;
  const [settings, services, service, { contact }] = await Promise.all([
    getSettings(),
    getServices(),
    slug ? getService(slug) : null,
    getPages(),
  ]);

  const structured = graph({
    "@type": "ContactPage",
    "@id": absolute("/contact"),
    url: absolute("/contact"),
    name: `${contact.title} | Jenkins Detailing`,
    description: contact.description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": BUSINESS_ID },
  });

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-32 pb-16">
      <JsonLd data={structured} />
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h1 className="font-display text-display-lg font-bold tracking-tight">{contact.title}</h1>
          {contact.intro ? <p className="text-bone/80 mt-6 max-w-[56ch]">{contact.intro}</p> : null}
          <div className="mt-12 max-w-xl">
            {service ? <p className="text-bone/70 mb-6">This request is about {service.title.toLowerCase()}.</p> : null}
            <QuoteForm
              key={service?.slug ?? "general"}
              services={services}
              service={service?.slug}
              contact={{ email: settings.email, phone: settings.phone, phoneDigits: settings.phoneDigits }}
            />
          </div>
        </div>
        <aside className="mt-16 lg:col-span-4 lg:col-start-9 lg:mt-0">
          <div className="hairline border-t pt-5">
            <p className="font-display text-display-md font-bold">
              <a href={telHref(settings.phoneDigits)} className="tabular-nums">
                {settings.phone}
              </a>
            </p>
            <a
              href={whatsappHref(settings.phoneDigits, "Hi Danny, I would like a quote for")}
              target="_blank"
              rel="noreferrer"
              className="text-accent-lit mt-3 inline-flex items-center gap-2 underline-offset-[6px] hover:underline"
            >
              <WhatsappLogo size={20} aria-hidden="true" />
              Send photos on WhatsApp
            </a>
            <p className="mt-4">
              <a href={`mailto:${settings.email}`} className="text-bone/80 hover:text-bone transition-colors">
                {settings.email}
              </a>
            </p>
            <address className="text-bone/70 mt-8 text-sm not-italic">
              {settings.addressLine}
              <br />
              {settings.town} {settings.postcode}
            </address>
            {settings.directionsUrl ? (
              <a
                href={settings.directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent-lit mt-2 inline-block text-sm underline-offset-[6px] hover:underline"
              >
                Directions
              </a>
            ) : null}
            <p className="text-bone/70 mt-6 text-sm">
              {lines(settings.hoursText).map((l, i) => (
                <span key={i}>
                  {i > 0 ? <br /> : null}
                  {l}
                </span>
              ))}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
