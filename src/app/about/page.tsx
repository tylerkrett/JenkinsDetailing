import type { Metadata } from "next";

import { QuoteActions } from "~/components/home/quote-actions";
import { JsonLd } from "~/components/site/json-ld";
import { Photo } from "~/components/site/photo";
import { getPages, getReviews, getServices, getSettings } from "~/lib/content";
import { paragraphs } from "~/lib/format";
import { OG, WEBSITE_ID, absolute, businessJsonLd, graph, ogImage, pageMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { about } = await getPages();
  return pageMetadata({
    title: about.title,
    description: about.description,
    path: "/about",
    images: [ogImage(OG.about, "Danny at Jenkins Detailing")],
  });
}

export default async function AboutPage() {
  const [settings, services, reviews, { about }] = await Promise.all([getSettings(), getServices(), getReviews(), getPages()]);
  const story = paragraphs(about.story);
  const structured = graph({
    "@type": "AboutPage",
    "@id": absolute("/about"),
    url: absolute("/about"),
    name: `${about.title} | Jenkins Detailing`,
    description: about.description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: businessJsonLd(settings, reviews),
  });

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-32 pb-16">
      <JsonLd data={structured} />
      <article className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="max-w-[62ch] lg:col-span-7">
          <h1 className="font-display text-display-lg font-bold tracking-tight">{about.title}</h1>
          {settings.tagline ? <p className="text-bone/70 mt-3">{settings.tagline}</p> : null}
          {about.intro ? <p className="text-bone/80 mt-6 text-lg">{about.intro}</p> : null}
          <div className="text-bone/85 mt-10 flex flex-col gap-5">
            {story.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <dl className="text-bone/70 mt-10 grid grid-cols-2 gap-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-bone/50">Since</dt>
              <dd className="font-display text-bone text-2xl font-bold tabular-nums">{settings.established}</dd>
            </div>
            <div>
              <dt className="text-bone/50">Based</dt>
              <dd className="font-display text-bone text-2xl font-bold">{settings.town}</dd>
            </div>
            {settings.carproApproved ? (
              <div>
                <dt className="text-bone/50">Approved</dt>
                <dd className="font-display text-bone text-2xl font-bold">CarPro</dd>
              </div>
            ) : null}
          </dl>
          <QuoteActions services={services} settings={settings} className="mt-12" />
        </div>
        {settings.portrait ? (
          <aside className="mt-14 lg:col-span-4 lg:col-start-9 lg:mt-0">
            <Photo
              image={settings.portrait}
              alt="Danny snow-foaming a car in the Jenkins Detailing bay"
              sizes="(min-width: 1024px) 33vw, 100vw"
              priority
              className="aspect-[3/4]"
            />
          </aside>
        ) : null}
      </article>
    </main>
  );
}
