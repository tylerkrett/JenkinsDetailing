import type { Metadata } from "next";

import { BeforeAfter } from "~/components/home/before-after";
import { QuoteActions } from "~/components/home/quote-actions";
import { JsonLd } from "~/components/site/json-ld";
import { Photo } from "~/components/site/photo";
import { getPages, getServices, getSettings, getWork } from "~/lib/content";
import { OG, WEBSITE_ID, absolute, graph, ogImage, pageMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { work } = await getPages();
  return pageMetadata({
    title: work.title,
    description: work.description,
    path: "/work",
    images: [ogImage(OG.work, "Work by Jenkins Detailing")],
  });
}

export default async function WorkPage() {
  const [jobs, services, settings, { work }] = await Promise.all([getWork(), getServices(), getSettings(), getPages()]);
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
      {jobs.length === 0 ? (
        <div className="hairline mt-14 border-t pt-8">
          <p className="text-bone/70 max-w-[48ch]">
            Job photos are being added. In the meantime, ask about your own car.
          </p>
          <QuoteActions services={services} settings={settings} className="mt-8" />
        </div>
      ) : (
        <ul className="work-gallery">
          {jobs.map((job) => {
            const meta = [job.vehicle, job.service ? byService.get(job.service) : ""].filter(Boolean).join(" · ");
            const alt = [job.vehicle || job.title, "Jenkins Detailing"].filter(Boolean).join(", ");
            return (
              <li key={job.slug} id={job.slug}>
                {job.before ? (
                  <BeforeAfter
                    pair={{ ...job, before: job.before }}
                    sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, calc(100vw - 3rem)"
                  />
                ) : (
                  <Photo image={job.after} alt={alt} sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, calc(100vw - 3rem)" />
                )}
                {meta || job.caption ? (
                  <p className="text-bone/55 mt-3 text-sm">
                    {meta}
                    {meta && job.caption ? " · " : null}
                    {job.caption}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
