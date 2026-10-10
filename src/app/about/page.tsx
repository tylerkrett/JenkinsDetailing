import type { Metadata } from "next";

import { QuoteActions } from "~/components/home/quote-actions";
import { JsonLd } from "~/components/site/json-ld";
import { Photo } from "~/components/site/photo";
import { Eyebrow } from "~/components/ui/section-header";
import { getPages, getProcess, getReviews, getServices, getSettings } from "~/lib/content";
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
  const [settings, services, reviews, { about }, steps] = await Promise.all([
    getSettings(),
    getServices(),
    getReviews(),
    getPages(),
    getProcess(),
  ]);
  const story = paragraphs(about.story);
  // The underside step has the real photo of the work at the unit.
  const underneath = steps.find((s) => s.service === "undersealing");
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
          <Eyebrow>
            Founded in {settings.established} / {settings.town}
          </Eyebrow>
          <h1 className="font-display text-display-lg mt-4 font-bold tracking-tight">{about.title}</h1>
          {settings.tagline ? <p className="text-bone/70 mt-3">{settings.tagline}</p> : null}
          {about.intro ? <p className="text-bone/80 mt-6 text-lg">{about.intro}</p> : null}
          <div className="text-bone/85 mt-10 flex flex-col gap-5">
            {story.slice(0, 2).map((p, i) => (
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
      {story.length > 2 ? (
        <section
          className="bg-photo-surface mt-24 grid gap-10 rounded-md p-6 sm:p-10 lg:grid-cols-2 lg:items-center"
          aria-labelledby="garage-story"
        >
          {underneath?.image ? (
            <Photo
              image={underneath.image}
              alt={`${underneath.title}, at ${settings.addressLine}`}
              sizes="(min-width: 1280px) 560px, (min-width: 1024px) 44vw, calc(100vw - 6rem)"
              className="aspect-[4/3] rounded-[4px]"
            />
          ) : null}
          <div>
            <Eyebrow>{settings.addressLine}</Eyebrow>
            <h2 id="garage-story" className="font-display text-display-md mt-4 font-bold tracking-tight">
              A family garage. <span className="sm:block">A proper detailing centre.</span>
            </h2>
            <div className="text-bone/75 mt-6 flex flex-col gap-4">
              {story.slice(2).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
