import type { Metadata } from "next";

import { ServiceCard } from "~/components/home/service-card";
import { JsonLd } from "~/components/site/json-ld";
import { Eyebrow } from "~/components/ui/section-header";
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
    <main id="main" className="site-container pt-32 pb-24">
      <JsonLd data={structured} />
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <Eyebrow>What we do</Eyebrow>
          <h1 className="font-display text-display-lg mt-4 font-bold tracking-tight">{copy.title}</h1>
          {copy.intro ? <p className="text-bone/80 mt-6 max-w-[60ch]">{copy.intro}</p> : null}
        </div>
      </div>
      <div className="service-grid service-grid-wide mt-14">
        {services.map((s, i) => (
          <ServiceCard key={s.slug} service={s} heading="h2" priority={i === 0} />
        ))}
      </div>
    </main>
  );
}
