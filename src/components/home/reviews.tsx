import { Star } from "@phosphor-icons/react/dist/ssr";

import { SectionHeader } from "~/components/ui/section-header";
import type { Review, SiteSettings } from "~/lib/content";

import { ReviewCard } from "./review-card";

type Props = { settings: Pick<SiteSettings, "googleRating" | "googleReviewCount">; reviews: Review[] };

/** The rating, when confirmed, and up to three quoted reviews. Renders nothing without either. */
export function Reviews({ settings, reviews }: Props) {
  const quoted = [...reviews.filter((r) => r.featured), ...reviews.filter((r) => !r.featured)].slice(0, 3);
  const hasRating = settings.googleRating !== undefined && settings.googleReviewCount !== undefined;
  if (!hasRating && quoted.length === 0) return null;
  return (
    <section aria-labelledby="reviews" className="site-container section-space">
      <SectionHeader id="reviews" eyebrow="Reviews" title="What customers say" />
      {hasRating ? (
        <p className="text-bone/70 mt-5 flex items-center gap-2">
          <Star size={18} weight="fill" className="text-accent-lit" aria-hidden="true" />
          <span>
            <span className="text-bone font-semibold">{settings.googleRating}</span> on Google from{" "}
            {settings.googleReviewCount} reviews
          </span>
        </p>
      ) : null}
      {quoted.length > 0 ? (
        <ul data-reveal className="mt-10 grid gap-6 md:grid-cols-3">
          {quoted.map((r, i) => (
            <li key={i}>
              <ReviewCard review={r} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
