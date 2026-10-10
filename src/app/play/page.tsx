import type { Metadata } from "next";
import Link from "next/link";

import { BucketRun } from "~/components/game/bucket-run";
import styles from "~/components/game/play.module.css";
import { JsonLd } from "~/components/site/json-ld";
import { OG, WEBSITE_ID, absolute, businessRef, graph, ogImage, pageMetadata } from "~/lib/seo";

const TITLE = "Bucket Run";
const DESCRIPTION =
  "The night shift at Rose Garage: jump the cones, duck the red kites and collect the bottles that polish the cars. Plays offline too.";

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
    <main id="main" className={styles.page}>
      <JsonLd data={structured} />
      <h1 className="sr-only">{TITLE}</h1>
      <BucketRun />

      <section aria-labelledby="how-to-play" className={styles.notes}>
        <div>
          <h2 id="how-to-play">How to play</h2>
          <dl className={styles.controls}>
            <div>
              <dt>
                <kbd>Space</kbd>
                <kbd>↑</kbd>
              </dt>
              <dd>Jump. Hold it for a higher one.</dd>
            </div>
            <div>
              <dt>
                <kbd>↓</kbd>
              </dt>
              <dd>Duck under a low kite. In the air, it drops you fast.</dd>
            </div>
            <div>
              <dt>
                <kbd>P</kbd>
              </dt>
              <dd>Pause.</dd>
            </div>
          </dl>
          <p>On a phone, tap the game to jump and swipe down to duck, or use the buttons under it.</p>
        </div>
        <div>
          <h2>Bottles polish the cars</h2>
          <p>
            Each bottle is worth five points. Every ten polish another panel on the cars waiting in the bays; collect
            eighty and they gleam. High kites fly clear over a bucket that stays on the ground.
          </p>
        </div>
        <div>
          <h2>It plays offline</h2>
          <p>
            Lose signal while you are on the site and Bucket Run opens instead. Your best score stays on this device.
          </p>
        </div>
      </section>

      <section aria-label="Book a real clean" className={styles.cta}>
        <p className={styles.ctaLine}>Rather have a real clean?</p>
        <div className={styles.ctaActions}>
          <Link href="/contact" className="button-primary">
            Get a quote
          </Link>
          <Link href="/services" className="button-outline">
            See the services
          </Link>
        </div>
      </section>
    </main>
  );
}
