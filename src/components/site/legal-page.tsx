import { JsonLd } from "~/components/site/json-ld";
import type { SiteSettings } from "~/lib/content";
import { paragraphs } from "~/lib/format";
import { WEBSITE_ID, absolute, graph } from "~/lib/seo";

type Props = {
  path: "/privacy" | "/terms";
  title: string;
  description: string;
  body: string;
  settings: SiteSettings;
};

/** Privacy and terms: plain text from the CMS with the company details underneath. */
export function LegalPage({ path, title, description, body, settings }: Props) {
  const structured = graph({
    "@type": "WebPage",
    "@id": absolute(path),
    url: absolute(path),
    name: `${title} | Jenkins Detailing`,
    description,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
  });
  const legal = [
    settings.legalName,
    settings.companyNumber ? `Company number ${settings.companyNumber}` : "",
    settings.registeredOffice ? `Registered office: ${settings.registeredOffice}` : "",
  ].filter(Boolean);
  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-32 pb-16">
      <JsonLd data={structured} />
      <article className="max-w-[62ch] lg:ml-[calc(100%/12)]">
        <h1 className="font-display text-display-lg font-bold tracking-tight">{title}</h1>
        <div className="text-bone/85 mt-10 flex flex-col gap-5">
          {paragraphs(body).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {legal.length ? <p className="text-bone/50 mt-12 text-sm">{legal.join(". ")}.</p> : null}
        <p className="text-bone/50 mt-2 text-sm">
          Questions:{" "}
          <a href={`mailto:${settings.email}`} className="hover:text-bone underline underline-offset-4">
            {settings.email}
          </a>
        </p>
      </article>
    </main>
  );
}
