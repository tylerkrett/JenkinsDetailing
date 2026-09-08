import { jsonLd } from "~/lib/seo";

type Props = { data: Record<string, unknown> };

/** One structured-data block. Pages render at most one of these, holding a graph. */
export function JsonLd({ data }: Props) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
  );
}
