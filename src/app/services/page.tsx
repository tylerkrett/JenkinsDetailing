import type { Metadata } from "next";

import { ServiceCard } from "~/components/home/service-card";
import { JsonLd } from "~/components/site/json-ld";
import { getPages, getServices } from "~/lib/content";
import { OG, WEBSITE_ID, absolute, graph, itemList, ogImage, pageMetadata, serviceEntity } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { services } = await getPages();
  return pageMetadata({
    title: services.title,
    description: services.description,
    path: "/services",
    images: [ogImage(OG.services, "Jenkins Detailing services")],
  });
}

export default async function ServicesPage() {
  const [services, { services: copy }] = await Promise.all([getServices(), getPages()]);
  const structured = graph({
    "@type": "CollectionPage",
    "@id": absolute("/services"),
    url: absolute("/services"),
    name: `${copy.title} | Jenkins Detailing`,
    description: copy.description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: itemList(services.map((s) => serviceEntity(s))),
  });

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-32 pb-16">
      <JsonLd data={structured} />
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h1 className="font-display text-display-lg font-bold tracking-tight">{copy.title}</h1>
          {copy.intro ? <p className="text-bone/80 mt-6 max-w-[60ch]">{copy.intro}</p> : null}
        </div>
      </div>
      <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <ServiceCard key={s.slug} service={s} />
        ))}
      </div>
    </main>
  );
}
