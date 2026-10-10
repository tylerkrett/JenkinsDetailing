import type { SiteSettings } from "~/lib/content";

import { CountUp } from "./count-up";

type Fact = { label: string; value: string; count?: boolean };

/**
 * The facts a visitor checks before they ask: the CarPro approval, the years, the
 * Google rating once it is confirmed and the stats from the CMS. Four at most.
 */
export function ProofStrip({ settings: s }: { settings: SiteSettings }) {
  const rated = s.googleRating !== undefined && s.googleReviewCount !== undefined;
  const facts: Fact[] = [
    ...(s.carproApproved ? [{ label: "Approved detailing centre", value: "CarPro" }] : []),
    { label: "Detailing since", value: String(s.established) },
    ...(rated
      ? [{ label: `From ${s.googleReviewCount} Google reviews`, value: `${s.googleRating} / 5`, count: true }]
      : []),
    ...s.stats.map((stat) => ({ ...stat, count: true })),
    { label: "Based in", value: s.town },
  ].slice(0, 4);

  return (
    <section aria-label="Why Jenkins Detailing" className="proof-strip">
      <dl className="site-container grid grid-cols-2 lg:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.count ? <CountUp value={f.value} /> : f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
