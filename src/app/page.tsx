import { ArrowUpRight, Play } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { ActStepper } from "~/components/home/act-stepper";
import { BeforeAfter } from "~/components/home/before-after";
import { ContactBlock } from "~/components/home/contact-block";
import { HeroVideo } from "~/components/home/hero-video";
import { ProofStrip } from "~/components/home/proof-strip";
import { QuoteActions } from "~/components/home/quote-actions";
import { Reviews } from "~/components/home/reviews";
import { SectionReveals } from "~/components/home/section-reveals";
import { CARD_SIZES, ServiceCard } from "~/components/home/service-card";
import { JsonLd } from "~/components/site/json-ld";
import { Photo } from "~/components/site/photo";
import { Eyebrow, SectionHeader } from "~/components/ui/section-header";
import {
  type ProcessedImage,
  getPages,
  getProcess,
  getReviews,
  getServices,
  getSettings,
  getWork,
} from "~/lib/content";
import { paragraphs } from "~/lib/format";
import {
  OG,
  SITE_DESCRIPTION,
  SITE_NAME,
  WEBSITE_ID,
  absolute,
  graph,
  itemList,
  ogImage,
  pageMetadata,
  serviceEntity,
} from "~/lib/seo";

async function homeCopy() {
  const { home } = await getPages();
  return { title: `${SITE_NAME} | ${home.title}`, description: home.description || SITE_DESCRIPTION };
}

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = await homeCopy();
  return {
    ...pageMetadata({ title, description, path: "/", images: [ogImage(OG.site, "Jenkins Detailing, Tregaron")] }),
    title: { absolute: title },
  };
}

/**
 * Hands out each photo once: the first candidate the page has not shown yet. With only a
 * couple of real photos so far this keeps the hero, the cards and the story from
 * repeating each other; stills from the bay fill the gaps.
 */
function photoPicker() {
  const used = new Set<string>();
  const picker = (...candidates: (ProcessedImage | undefined)[]) => {
    const pick = candidates.find((c) => c && !used.has(c.sizes[0]!.src)) ?? candidates.find(Boolean);
    if (pick) used.add(pick.sizes[0]!.src);
    return pick;
  };
  /** Every photo already handed out, so the work strip below can skip them. */
  picker.used = used;
  return picker;
}

/** The shop front: photo-led, fast, no WebGL. The scene lives on /watch. */
export default async function HomePage() {
  const [settings, services, steps, reviews, pairs, { home, about }, { title, description }] = await Promise.all([
    getSettings(),
    getServices(),
    getProcess(),
    getReviews(),
    getWork(),
    getPages(),
    homeCopy(),
  ]);
  const headline = home.headline || settings.promise || SITE_NAME;
  const featured = services.filter((s) => s.featured).slice(0, 4);
  const pair = pairs.find((p) => p.featured && p.before) ?? pairs.find((p) => p.before);
  const reveal = steps.at(-1);
  const story = paragraphs(about.story);

  const pick = photoPicker();
  const hero = pick(home.heroImage, settings.portrait, reveal?.still);
  const cards = featured.map((service) => ({ service, image: pick(service.image, service.still) }));
  const finish = pair ? undefined : pick(reveal?.still, reveal?.image);
  const unit = pick(settings.unitPhoto, ...steps.map((s) => s.still));
  // The work strip only shows jobs whose photo is not already on the page above it.
  const shown = new Set(pick.used);
  for (const step of steps) {
    if (step.still) shown.add(step.still.sizes[0]!.src);
  }
  const shots = pairs.filter((p) => !p.before && !shown.has(p.after.sizes[0]!.src)).slice(0, 4);
  const unitAlt =
    unit === settings.unitPhoto
      ? `The Jenkins Detailing unit at ${settings.addressLine}, ${settings.town}`
      : `${settings.addressLine} in ${settings.town}, from our 3D model of the unit`;

  const structured = graph({
    "@type": "WebPage",
    "@id": absolute("/"),
    url: absolute("/"),
    name: title,
    description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: itemList(services.map((s) => serviceEntity(s))),
  });

  return (
    <main id="main">
      <JsonLd data={structured} />
      <SectionReveals />

      <section aria-labelledby="hero-title" className="home-hero">
        {hero ? <Photo image={hero} alt="" sizes="100vw" priority className="hero-image h-full!" /> : null}
        {home.heroVideo ? <HeroVideo src={home.heroVideo} /> : null}
        <div className="hero-shade" />
        <div className="site-container relative w-full">
          <Eyebrow>
            {settings.name} / {settings.town}, Mid Wales
          </Eyebrow>
          <h1 id="hero-title" className="hero-title font-display">
            {headline}
          </h1>
          {home.subline ? <p className="hero-intro">{home.subline}</p> : null}
          <QuoteActions services={services} settings={settings} className="mt-9" />
          <Link href="/watch" className="hero-watch">
            <span className="play-glyph" aria-hidden="true">
              <Play size={12} weight="fill" />
            </span>
            Watch how it works
          </Link>
        </div>
        <p className="hero-caption">
          {settings.addressLine}, {settings.town}
        </p>
      </section>

      <ProofStrip settings={settings} />

      <section aria-labelledby="services" className="site-container section-space">
        <SectionHeader
          id="services"
          eyebrow="Care, correction, protection"
          title="Good cars deserve proper care."
          href="/services"
          link="All services"
        />
        <div data-reveal className="service-grid">
          {cards.map(({ service, image }) => (
            <ServiceCard key={service.slug} service={service} image={image} sizes={CARD_SIZES.two} />
          ))}
        </div>
      </section>

      <section aria-labelledby="process" className="process-section section-space">
        <div className="site-container">
          <SectionHeader
            id="process"
            eyebrow="Inside the bay"
            title="Nothing rushed. Nothing missed."
            href="/watch"
            link="Watch the whole job"
          />
          <p className="text-bone/70 mt-6 max-w-[56ch]">
            The same steps on every car, in the order the work happens, each with a reason. Pick a step to see it in the
            bay.
          </p>
          <ActStepper steps={steps} />
        </div>
      </section>

      <section aria-labelledby="work" className="site-container section-space">
        <SectionHeader
          id="work"
          eyebrow="The finish"
          title="Let the finish do the talking."
          href={pair || shots.length ? "/work" : undefined}
          link="More of our work"
        />
        {pair?.before ? (
          <div data-reveal className="mt-10">
            <BeforeAfter pair={{ ...pair, before: pair.before }} />
          </div>
        ) : shots.length ? (
          <ul data-reveal className="work-home-strip">
            {shots.map((job) => (
              <li key={job.slug}>
                <Link href="/work" className="block">
                  <Photo
                    image={job.after}
                    alt={job.vehicle || job.title}
                    sizes="(min-width: 1280px) 300px, 45vw"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : finish && reveal ? (
          <div data-reveal className="finish-feature">
            <Photo
              image={finish}
              alt="The finished car under the bay lights, from our 3D model"
              sizes="(min-width: 1280px) 720px, (min-width: 768px) 56vw, calc(100vw - 3rem)"
              className="aspect-[16/10] h-full!"
            />
            <div className="finish-copy">
              <p className="font-display text-display-md font-bold tracking-tight">{reveal.title}</p>
              <p className="text-bone/80 mt-4">{reveal.what}</p>
              <p className="text-bone/60 mt-3">{reveal.why}</p>
              <Link href={`/watch?act=${reveal.act}`} className="text-link mt-8">
                Watch the reveal
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <Reviews settings={settings} reviews={reviews} />

      {story.length > 0 ? (
        <section aria-labelledby="about" className="story-section section-space">
          <div data-reveal className="site-container grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            {unit ? (
              <Photo
                image={unit}
                alt={unitAlt}
                sizes="(min-width: 1280px) 584px, (min-width: 1024px) 46vw, calc(100vw - 3rem)"
                className="aspect-[4/3] rounded-md"
              />
            ) : null}
            <div>
              <Eyebrow>Founded in {settings.established}</Eyebrow>
              <h2 id="about" className="font-display text-display-lg mt-4 font-bold tracking-tight">
                Danny, and the unit.
              </h2>
              <div className="text-bone/75 mt-8 flex max-w-[60ch] flex-col gap-5">
                {story.slice(0, 2).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <Link href="/about" className="text-link mt-8">
                About Jenkins Detailing
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <ContactBlock settings={settings} services={services} />
    </main>
  );
}
