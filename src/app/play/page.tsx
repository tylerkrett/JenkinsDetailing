import type { Metadata } from "next";

import { StreetRun } from "~/components/game/street-run";
import { JsonLd } from "~/components/site/json-ld";
import { OG, WEBSITE_ID, absolute, businessRef, graph, ogImage, pageMetadata } from "~/lib/seo";

const TITLE = "Bucket Run";
const DESCRIPTION =
  "Run the forecourt, jump the cones, duck the shutter, collect the bottles. Online or off.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/play",
  images: [ogImage(OG.play, "Bucket Run, the Jenkins Detailing game")],
});

export default function PlayPage() {
  const structured = graph({
    "@type": "VideoGame",
    "@id": absolute("/play"),
    url: absolute("/play"),
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: "en-GB",
    genre: "Endless runner",
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    isPartOf: { "@id": WEBSITE_ID },
    author: businessRef(),
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  });

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 pt-24 pb-16 sm:pt-28">
      <JsonLd data={structured} />
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h1 className="font-display text-display-md font-bold tracking-tight">{TITLE}</h1>
        <p className="text-bone/60 text-sm sm:text-base">
          <span className="[@media(pointer:fine)]:hidden">Tap to jump, swipe down to duck.</span>
          <span className="hidden [@media(pointer:fine)]:inline">Space jumps, down arrow ducks.</span>
        </p>
      </div>
      <StreetRun />
    </main>
  );
}
