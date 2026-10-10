import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { ProcessList } from "~/components/home/process-list";
import { QuoteActions } from "~/components/home/quote-actions";
import { JsonLd } from "~/components/site/json-ld";
import { Eyebrow } from "~/components/ui/section-header";
import { WatchView } from "~/components/watch/watch-view";
import { getPages, getProcess, getServices, getSettings } from "~/lib/content";
import { OG, WEBSITE_ID, absolute, graph, ogImage, pageMetadata } from "~/lib/seo";
import { VIEW_COOKIE, parseView } from "~/lib/view";

export async function generateMetadata(): Promise<Metadata> {
  const { process } = await getPages();
  return pageMetadata({
    title: process.title,
    description: process.description,
    path: "/watch",
    images: [ogImage(OG.process, "How Jenkins Detailing does it")],
  });
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * How the job is done, two ways: the scroll-driven 3D bay, or the same steps as a plain
 * page. The cookie (or a ?view= link) picks the version on the server; see WatchView.
 */
export default async function WatchPage({ searchParams }: Props) {
  const [params, jar, head, steps, services, settings, { process, home }] = await Promise.all([
    searchParams,
    cookies(),
    headers(),
    getProcess(),
    getServices(),
    getSettings(),
    getPages(),
  ]);
  const saved = parseView(typeof params.view === "string" ? params.view : undefined) ?? parseView(jar.get(VIEW_COOKIE)?.value);
  const headline = home.headline || settings.promise;

  const structured = graph({
    "@type": "HowTo",
    "@id": absolute("/watch"),
    url: absolute("/watch"),
    name: process.title,
    description: process.description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    step: steps.map((s) => ({
      "@type": "HowToStep",
      position: s.act,
      name: s.title,
      text: `${s.what} ${s.why}`,
      url: absolute(`/watch#${s.slug}`),
    })),
  });

  // Keyed because WatchView renders it beside siblings, and an element that arrives from
  // the server as a prop is otherwise flagged as an unkeyed list child.
  const plain = (
    <main key="plain" id="main" className="site-container pt-40 pb-16">
      <div className="max-w-3xl">
        <Eyebrow>Step by step</Eyebrow>
        <h1 className="font-display text-display-lg mt-4 font-bold tracking-tight">{process.title}</h1>
        {process.intro ? <p className="text-bone/80 mt-6 max-w-[60ch]">{process.intro}</p> : null}
      </div>
      <div className="mt-14">
        <ProcessList steps={steps} full />
      </div>
      <div className="hairline mt-4 border-t pt-10">
        <QuoteActions services={services} settings={settings} />
      </div>
    </main>
  );

  return (
    <>
      <JsonLd data={structured} />
      <WatchView saved={saved} saveData={head.get("save-data") === "on"} steps={steps} headline={headline} plain={plain}>
        <section className="site-container pt-[40vh] pb-20">
          <h2 className="font-display text-display-xl max-w-4xl font-extrabold tracking-tight">{headline}</h2>
          {home.subline ? <p className="text-bone/80 mt-6 max-w-[48ch] text-lg">{home.subline}</p> : null}
          <QuoteActions services={services} settings={settings} className="mt-10" />
        </section>
      </WatchView>
    </>
  );
}
