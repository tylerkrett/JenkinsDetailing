import type { Metadata } from "next";
import Link from "next/link";

import { ContactBlock } from "~/components/home/contact-block";
import { ProcessList } from "~/components/home/process-list";
import { QuoteActions } from "~/components/home/quote-actions";
import { Reviews } from "~/components/home/reviews";
import { ServiceCard } from "~/components/home/service-card";
import { BayExperience } from "~/components/scene/bay/bay-experience";
import { JsonLd } from "~/components/site/json-ld";
import { Photo } from "~/components/site/photo";
import {
  type ProcessStep,
  type Service,
  type SiteSettings,
  getPages,
  getProcess,
  getReviews,
  getServices,
  getSettings,
} from "~/lib/content";
import { paragraphs } from "~/lib/format";
import { OG, SITE_DESCRIPTION, SITE_NAME, WEBSITE_ID, absolute, graph, itemList, ogImage, pageMetadata, serviceEntity } from "~/lib/seo";

async function homeCopy() {
  const { home } = await getPages();
  return { title: `${SITE_NAME} | ${home.title}`, description: home.description || SITE_DESCRIPTION, home };
}

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = await homeCopy();
  return {
    ...pageMetadata({ title, description, path: "/", images: [ogImage(OG.site, "Jenkins Detailing, Tregaron")] }),
    title: { absolute: title },
  };
}

type HomeData = {
  settings: SiteSettings;
  services: Service[];
  steps: ProcessStep[];
  headline: string;
  subline: string;
};

/** The static home: what search engines, reduced motion and no-WebGL visitors get. */
function StaticHome({ settings, services, steps, headline, subline }: HomeData) {
  const featured = services.filter((s) => s.featured);
  return (
    <main id="main">
      <section className="mx-auto max-w-7xl px-6 pt-32 pb-16 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <h1 className="font-display text-display-xl font-extrabold tracking-tight">{headline}</h1>
          <p className="text-bone/80 mt-6 max-w-[48ch] text-lg">{subline}</p>
          <QuoteActions services={services} settings={settings} className="mt-10" />
        </div>
        {settings.portrait ? (
          <div className="mt-12 lg:col-span-6 lg:mt-0">
            <Photo
              image={settings.portrait}
              alt="Danny snow-foaming a car in the Jenkins Detailing bay"
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
              className="aspect-[3/2]"
            />
          </div>
        ) : null}
      </section>
      <section aria-labelledby="static-process" className="mx-auto max-w-7xl px-6 py-16">
        <h2 id="static-process" className="font-display text-display-lg font-bold tracking-tight">
          How we do it
        </h2>
        <div className="mt-8">
          <ProcessList steps={steps} />
        </div>
      </section>
      <section aria-labelledby="static-services" className="mx-auto max-w-7xl px-6 py-16">
        <h2 id="static-services" className="font-display text-display-lg font-bold tracking-tight">
          Services
        </h2>
        <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
      </section>
    </main>
  );
}

export default async function HomePage() {
  const [settings, services, steps, reviews, { home, about }] = await Promise.all([
    getSettings(),
    getServices(),
    getProcess(),
    getReviews(),
    getPages(),
  ]);
  const headline = home.headline || settings.promise || SITE_NAME;
  const subline = home.subline;
  const featured = services.filter((s) => s.featured);
  const story = paragraphs(about.story);

  const structured = graph({
    "@type": "WebPage",
    "@id": absolute("/"),
    url: absolute("/"),
    name: `${SITE_NAME} | ${home.title}`,
    description: home.description || SITE_DESCRIPTION,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: itemList(services.map((s) => serviceEntity(s))),
  });

  return (
    <>
      <JsonLd data={structured} />
      <BayExperience
        steps={steps}
        headline={headline}
        fallback={<StaticHome settings={settings} services={services} steps={steps} headline={headline} subline={subline} />}
      >
        {/* After the reveal: the promise and the two ways to ask. */}
        <section className="mx-auto max-w-7xl px-6 pt-[40vh] pb-20 lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <h2 className="font-display text-display-xl font-extrabold tracking-tight">{headline}</h2>
            <p className="text-bone/80 mt-6 max-w-[48ch] text-lg">{subline}</p>
            <QuoteActions services={services} settings={settings} className="mt-10" />
          </div>
        </section>

        <section aria-labelledby="services" className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex items-end justify-between gap-6">
            <h2 id="services" className="font-display text-display-lg font-bold tracking-tight">
              Services
            </h2>
            <Link href="/services" className="text-accent-lit underline-offset-[6px] hover:underline">
              All services
            </Link>
          </div>
          <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <ServiceCard key={s.slug} service={s} />
            ))}
          </div>
        </section>

        <section aria-labelledby="process" className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex items-end justify-between gap-6">
            <h2 id="process" className="font-display text-display-lg font-bold tracking-tight">
              How we do it
            </h2>
            <Link href="/process" className="text-accent-lit underline-offset-[6px] hover:underline">
              Step by step
            </Link>
          </div>
          <div className="mt-8">
            <ProcessList steps={steps} />
          </div>
        </section>

        <Reviews settings={settings} reviews={reviews} />

        {story.length > 0 ? (
          <section aria-labelledby="about" className="mx-auto max-w-7xl px-6 py-20 lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-6">
              <h2 id="about" className="font-display text-display-lg font-bold tracking-tight">
                Danny, and the unit
              </h2>
              <div className="text-bone/85 mt-6 flex flex-col gap-5">
                {story.slice(0, 2).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <Link href="/about" className="text-accent-lit mt-6 inline-block underline-offset-[6px] hover:underline">
                About Jenkins Detailing
              </Link>
            </div>
            {settings.portrait ? (
              <div className="mt-10 lg:col-span-5 lg:col-start-8 lg:mt-0">
                <Photo
                  image={settings.portrait}
                  alt="Danny snow-foaming a car in the Jenkins Detailing bay"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="aspect-[4/3]"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <ContactBlock settings={settings} services={services} />
      </BayExperience>
    </>
  );
}
