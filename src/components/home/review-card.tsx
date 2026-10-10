import { FacebookLogo, GoogleLogo, Star } from "@phosphor-icons/react/dist/ssr";

import type { Review } from "~/lib/content";

const SOURCE = {
  google: { label: "Google review", Icon: GoogleLogo },
  facebook: { label: "Facebook review", Icon: FacebookLogo },
  direct: { label: "Customer review", Icon: null },
} as const;

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** One quoted review: the stars, the words, who said it, where and when. */
export function ReviewCard({ review: r }: { review: Review }) {
  const { label, Icon } = SOURCE[r.source];
  return (
    <figure className="bg-ink-2 flex h-full flex-col rounded-md p-7">
      <p role="img" aria-label={`${r.rating} out of 5 stars`} className="text-accent-lit flex gap-1">
        {Array.from({ length: r.rating }, (_, i) => (
          <Star key={i} size={16} weight="fill" aria-hidden="true" />
        ))}
      </p>
      <blockquote className="mt-5 flex-1 text-lg">{r.text}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 text-sm">
        {Icon ? <Icon size={22} aria-hidden="true" className="text-bone/70 shrink-0" /> : null}
        <span>
          <span className="block font-semibold">{r.author}</span>
          <span className="text-bone/60 block">
            {label}
            {r.date ? (
              <>
                {" · "}
                <time dateTime={r.date}>{MONTH.format(new Date(`${r.date}T00:00:00Z`))}</time>
              </>
            ) : null}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
