import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuoteActions } from "~/components/home/quote-actions";
import { JsonLd } from "~/components/site/json-ld";
import { Photo } from "~/components/site/photo";
import { getPackages, getProcess, getService, getServices, getSettings } from "~/lib/content";
import { fromPrice, paragraphs } from "~/lib/format";
import { OG, breadcrumbs, graph, ogImage, pageMetadata, serviceEntity } from "~/lib/seo";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const services = await getServices();
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getService(slug);
  if (!s) return {};
  return pageMetadata({
    title: s.title,
    description: s.promise || s.description.slice(0, 160),
    path: `/services/${s.slug}`,
    images: [ogImage(OG.service(s.slug), `${s.title} by Jenkins Detailing`)],
  });
}

export default async function ServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [service, services, settings, packages, steps] = await Promise.all([
    getService(slug),
    getServices(),
    getSettings(),
    getPackages(slug),
    getProcess(),
  ]);
  if (!service) notFound();
  const price = fromPrice(service.fromPriceGBP);
  const related = steps.filter((st) => st.service === service.slug);

  const structured = graph(
    serviceEntity(service, true),
    breadcrumbs([
      { name: "Services", path: "/services" },
      { name: service.title, path: `/services/${service.slug}` },
    ]),
  );

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-32 pb-16">
      <JsonLd data={structured} />
      <p className="text-bone/50 text-sm">
        <Link href="/services" className="hover:text-bone transition-colors">
          Services
        </Link>
      </p>
      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-8">
        <article className="lg:col-span-7">
          <h1 className="font-display text-display-lg font-bold tracking-tight">{service.title}</h1>
          {service.promise ? <p className="text-bone/80 mt-5 max-w-[56ch] text-lg">{service.promise}</p> : null}
          {service.image ? (
            <div className="mt-10">
              <Photo
                image={service.image}
                alt={service.title}
                sizes="(min-width: 1024px) 58vw, 100vw"
                priority
                className="aspect-[3/2]"
              />
            </div>
          ) : null}
          <div className="text-bone/85 mt-10 flex max-w-[62ch] flex-col gap-5">
            {paragraphs(service.description).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {packages.length > 0 ? (
            <section aria-labelledby="packages" className="mt-16">
              <h2 id="packages" className="font-display text-display-md font-bold tracking-tight">
                Packages
              </h2>
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                {packages.map((p) => (
                  <div key={p.slug} className="hairline border-t pt-5">
                    <h3 className="font-display text-xl font-bold">{p.name}</h3>
                    <p className="text-bone/70 mt-2">{p.summary}</p>
                    <p className="text-bone/50 mt-2 text-sm">
                      {p.priceGBP !== undefined ? fromPrice(p.priceGBP) : p.priceNote || "Priced on inspection"}
                      {p.stages ? ` · ${p.stages} ${p.stages === 1 ? "stage" : "stages"}` : ""}
                    </p>
                    <ol className="text-bone/80 mt-4 flex flex-col gap-2 text-sm">
                      {p.steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-accent-lit font-display tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section aria-labelledby="in-the-process" className="mt-16">
              <h2 id="in-the-process" className="font-display text-display-md font-bold tracking-tight">
                Where it sits in the job
              </h2>
              <ul className="mt-6 flex flex-col gap-4">
                {related.map((st) => (
                  <li key={st.slug} className="hairline border-t pt-4">
                    <p className="font-display text-accent text-sm font-bold tabular-nums">
                      {String(st.act).padStart(2, "0")}
                    </p>
                    <p className="mt-1 font-semibold">{st.title}</p>
                    <p className="text-bone/70 mt-1">{st.why}</p>
                  </li>
                ))}
              </ul>
              <Link href="/process" className="text-accent-lit mt-4 inline-block underline-offset-[6px] hover:underline">
                The whole process
              </Link>
            </section>
          ) : null}
        </article>

        <aside className="mt-14 lg:sticky lg:top-28 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:self-start">
          <div className="hairline border-t pt-5">
            <p className="font-display text-display-md font-bold">{price ?? "Priced on inspection"}</p>
            {service.priceNote ? <p className="text-bone/70 mt-2 text-sm">{service.priceNote}</p> : null}
            {service.includes.length > 0 ? (
              <>
                <h2 className="text-bone/50 mt-6 text-sm font-semibold">Included</h2>
                <ul className="text-bone/85 mt-2 flex flex-col gap-1.5 text-sm">
                  {service.includes.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <dl className="text-bone/70 mt-6 flex flex-col gap-2 text-sm">
              {service.duration ? (
                <div className="flex gap-3">
                  <dt className="text-bone/50 w-24 shrink-0">Takes</dt>
                  <dd>{service.duration}</dd>
                </div>
              ) : null}
              {service.guarantee ? (
                <div className="flex gap-3">
                  <dt className="text-bone/50 w-24 shrink-0">Guarantee</dt>
                  <dd>{service.guarantee}</dd>
                </div>
              ) : null}
              <div className="flex gap-3">
                <dt className="text-bone/50 w-24 shrink-0">Where</dt>
                <dd>{service.mobile ? "At the unit in Tregaron, or at your door" : "At the unit in Tregaron"}</dd>
              </div>
            </dl>
            <QuoteActions services={services} settings={settings} service={service} className="mt-8" />
          </div>
        </aside>
      </div>
    </main>
  );
}
