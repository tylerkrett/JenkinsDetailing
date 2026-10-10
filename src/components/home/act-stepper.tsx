import Link from "next/link";

import { Photo } from "~/components/site/photo";
import type { ProcessStep } from "~/lib/content";

/**
 * The job as a strip of tiles, in the order the work happens, each with a still from the
 * bay. A tile opens that act on the Watch page, in 3D or in the plain steps.
 */
export function ActStepper({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol data-reveal className="act-stepper" aria-label="The steps, in order">
      {steps.map((s) => {
        const image = s.still ?? s.image;
        return (
          <li key={s.slug}>
            <Link href={`/watch?act=${s.act}`} className="act-tile group">
              {image ? <Photo image={image} alt="" sizes="260px" className="aspect-[4/3] rounded-[4px]" /> : null}
              <div className="flex gap-4 pt-5">
                <span className="text-accent-lit text-sm font-semibold tabular-nums">
                  {String(s.act).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="group-hover:text-accent-lit text-lg font-semibold transition-colors">{s.title}</h3>
                  <p className="text-bone/65 mt-2 text-sm">{s.what}</p>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
