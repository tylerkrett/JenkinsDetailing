import type { Metadata } from "next";

import { ProcessList } from "~/components/home/process-list";
import { QuoteActions } from "~/components/home/quote-actions";
import { JsonLd } from "~/components/site/json-ld";
import { getPages, getProcess, getServices, getSettings } from "~/lib/content";
import { OG, WEBSITE_ID, absolute, graph, ogImage, pageMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { process } = await getPages();
  return pageMetadata({
    title: process.title,
    description: process.description,
    path: "/process",
    images: [ogImage(OG.process, "How Jenkins Detailing does it")],
  });
}

export default async function ProcessPage() {
  const [steps, services, settings, { process }] = await Promise.all([getProcess(), getServices(), getSettings(), getPages()]);
  const structured = graph({
    "@type": "HowTo",
    "@id": absolute("/process"),
    url: absolute("/process"),
    name: process.title,
    description: process.description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    step: steps.map((s) => ({
      "@type": "HowToStep",
      position: s.act,
      name: s.title,
      text: `${s.what} ${s.why}`,
      url: absolute(`/process#${s.slug}`),
    })),
  });

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-32 pb-16">
      <JsonLd data={structured} />
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h1 className="font-display text-display-lg font-bold tracking-tight">{process.title}</h1>
          {process.intro ? <p className="text-bone/80 mt-6 max-w-[60ch]">{process.intro}</p> : null}
        </div>
      </div>
      <div className="mt-14">
        <ProcessList steps={steps} full />
      </div>
      <div className="hairline mt-4 border-t pt-10">
        <QuoteActions services={services} settings={settings} />
      </div>
    </main>
  );
}
