import { Star } from "@phosphor-icons/react/dist/ssr";

import type { Review, SiteSettings } from "~/lib/content";

type Props = { settings: Pick<SiteSettings, "googleRating" | "googleReviewCount">; reviews: Review[] };

const SOURCE = { google: "Google", facebook: "Facebook", direct: "" } as const;

/** The rating, when confirmed, and up to three quoted reviews. Renders nothing without either. */
export function Reviews({ settings, reviews }: Props) {
  const quoted = [...reviews.filter((r) => r.featured), ...reviews.filter((r) => !r.featured)].slice(0, 3);
  const hasRating = settings.googleRating !== undefined && settings.googleReviewCount !== undefined;
  if (!hasRating && quoted.length === 0) return null;
  return (
    <section aria-labelledby="reviews" className="mx-auto max-w-7xl px-6 py-20">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <h2 id="reviews" className="font-display text-display-lg font-bold tracking-tight">
            What customers say
          </h2>
          {hasRating ? (
            <p className="text-bone/70 mt-4 flex items-center gap-2">
              <Star size={18} weight="fill" className="text-accent-lit" aria-hidden="true" />
              <span>
                <span className="text-bone font-semibold">{settings.googleRating}</span> on Google from{" "}
                {settings.googleReviewCount} reviews
              </span>
            </p>
          ) : null}
        </div>
        {quoted.length > 0 ? (
          <ul className="mt-10 flex flex-col gap-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
            {quoted.map((r, i) => (
              <li key={i} className="hairline border-t pt-6">
                <p className="text-bone/90 text-lg">{r.text}</p>
                <p className="text-bone/50 mt-3 text-sm">
                  {r.author}
                  {SOURCE[r.source] ? `, ${SOURCE[r.source]}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
