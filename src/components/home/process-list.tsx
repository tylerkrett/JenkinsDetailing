import Link from "next/link";

import { Photo } from "~/components/site/photo";
import { cn } from "~/lib/cn";
import type { ProcessStep } from "~/lib/content";
import { paragraphs } from "~/lib/format";

const SIZES = "(min-width: 1024px) 40vw, calc(100vw - 3rem)";

type Props = { steps: ProcessStep[]; full?: boolean };

/**
 * The job as numbered steps, each with what is done and why. The numbers are real:
 * this is the order the work happens in. `full` adds the longer text and photos.
 */
export function ProcessList({ steps, full = false }: Props) {
  return (
    <ol className="flex flex-col">
      {steps.map((s) => (
        <li
          key={s.slug}
          id={s.slug}
          className={cn("hairline grid scroll-mt-40 gap-6 border-t py-8 lg:grid-cols-12 lg:gap-8", full && "py-12")}
        >
          <div className="lg:col-span-1">
            <span className="font-display text-accent-lit text-lg font-bold tabular-nums">
              {String(s.act).padStart(2, "0")}
            </span>
          </div>
          <div className={cn("flex flex-col gap-3", full && s.image ? "lg:col-span-6" : "lg:col-span-8")}>
            <h2 className="font-display text-display-md font-bold tracking-tight">{s.title}</h2>
            <p className="text-bone/90">{s.what}</p>
            <p className="text-bone/60">{s.why}</p>
            {full && s.text ? (
              <div className="text-bone/80 mt-2 flex flex-col gap-4">
                {paragraphs(s.text).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : null}
            {s.service ? (
              <Link
                href={`/services/${s.service}`}
                className="text-accent-lit mt-2 inline-block underline-offset-[6px] hover:underline"
              >
                About this service
              </Link>
            ) : null}
          </div>
          {full && s.image ? (
            <div className="lg:col-span-5">
              <Photo image={s.image} alt={s.title} sizes={SIZES} className="aspect-[4/3]" />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
