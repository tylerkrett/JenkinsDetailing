import type { Metadata } from "next";

import { BeforeAfter } from "~/components/home/before-after";
import { QuoteActions } from "~/components/home/quote-actions";
import { JsonLd } from "~/components/site/json-ld";
import { getPages, getServices, getSettings, getWork } from "~/lib/content";
import { OG, WEBSITE_ID, absolute, graph, ogImage, pageMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { work } = await getPages();
  return pageMetadata({
    title: work.title,
    description: work.description,
    path: "/work",
    images: [ogImage(OG.work, "Before and after, Jenkins Detailing")],
  });
}

export default async function WorkPage() {
  const [pairs, services, settings, { work }] = await Promise.all([getWork(), getServices(), getSettings(), getPages()]);
  const structured = graph({
    "@type": "CollectionPage",
    "@id": absolute("/work"),
    url: absolute("/work"),
    name: `${work.title} | Jenkins Detailing`,
    description: work.description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
  });
  const byService = new Map(services.map((s) => [s.slug, s.title]));

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-32 pb-16">
      <JsonLd data={structured} />
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h1 className="font-display text-display-lg font-bold tracking-tight">{work.title}</h1>
          {work.intro ? <p className="text-bone/80 mt-6 max-w-[60ch]">{work.intro}</p> : null}
        </div>
      </div>
      {pairs.length === 0 ? (
        <div className="hairline mt-14 border-t pt-8">
          <p className="text-bone/70 max-w-[48ch]">
            The before and after pairs are being photographed. In the meantime, ask about your own car.
          </p>
          <QuoteActions services={services} settings={settings} className="mt-8" />
        </div>
      ) : (
        <ul className="mt-14 grid gap-16 lg:grid-cols-2 lg:gap-10">
          {pairs.map((p) => (
            <li key={p.slug} id={p.slug} className="hairline border-t pt-8">
              <h2 className="font-display text-display-md font-bold tracking-tight">{p.title}</h2>
              <p className="text-bone/60 mt-2 text-sm">
                {[p.vehicle, p.service ? byService.get(p.service) : ""].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-6">
                <BeforeAfter pair={p} sizes="(min-width: 1280px) 600px, (min-width: 1024px) 48vw, calc(100vw - 3rem)" />
              </div>
              {p.caption ? <p className="text-bone/80 mt-4 max-w-[60ch]">{p.caption}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
