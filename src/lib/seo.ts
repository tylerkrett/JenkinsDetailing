import type { Metadata } from "next";

import { env } from "~/env";
import type { ProcessedImage, Review, Service, SiteSettings } from "~/lib/content";

/**
 * Everything the pages share for search and social: the canonical origin, the Open
 * Graph image contract, and the JSON-LD entities that describe the business and the
 * site. Pages compose these; nothing here reads content on its own.
 */

/** The public origin, without a trailing slash. Falls back to the dev origin used elsewhere. */
export const SITE_URL = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "Jenkins Detailing";

/** The one line the site leads with everywhere a description is needed and nothing better exists. */
export const SITE_DESCRIPTION =
  "Paint correction, ceramic protection, undersealing and full detailing in Tregaron, Mid Wales, and at your door. A CarPro approved detailing centre.";

/** Stable identifiers for the JSON-LD graph so every page points at the same business and site. */
export const BUSINESS_ID = `${SITE_URL}/#business`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** The Open Graph image contract. Every file is 1200x630 JPEG. */
export const OG = {
  site: "/og/site.jpg",
  services: "/og/services.jpg",
  process: "/og/process.jpg",
  work: "/og/work.jpg",
  about: "/og/about.jpg",
  contact: "/og/contact.jpg",
  play: "/og/play.jpg",
  service: (slug: string) => `/og/services/${slug}.jpg`,
} as const;

export function absolute(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

type OgImage = { url: string; width: number; height: number; alt: string; type?: string };

/** One Open Graph image entry at the contract size. */
export function ogImage(path: string, alt: string): OgImage {
  return { url: absolute(path), width: 1200, height: 630, alt, type: "image/jpeg" };
}

/** The first sentence of a block of text, or the trimmed text when it has no full stop. */
export function firstSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = /^[^.!?]*[.!?]/.exec(trimmed);
  return (match?.[0] ?? trimmed).trim();
}

type PageMetaInput = {
  title: string;
  description: string;
  /** Site-relative path, e.g. `/services/paint-correction`. */
  path: string;
  /** Open Graph images in order of preference; the first is what most scrapers use. */
  images: OgImage[];
  type?: "website" | "article" | "profile";
};

/**
 * The per-page metadata every route emits: canonical, Open Graph and Twitter mirroring
 * each other. Titles are passed bare; the layout template appends the site name.
 */
export function pageMetadata({ title, description, path, images, type = "website" }: PageMetaInput): Metadata {
  const url = absolute(path);
  const shareTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: SITE_NAME, locale: "en_GB", url, title: shareTitle, description, images },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: images.map((i) => ({ url: i.url, alt: i.alt, width: i.width, height: i.height })),
    },
  };
}

type JsonLdObject = Record<string, unknown>;

/** The derived file to hand scrapers: the 1024 rendition, else the first above it, else the largest. */
export function shareSrc(image: ProcessedImage | undefined) {
  if (!image) return undefined;
  const exact = image.sizes.find((s) => s.width === 1024);
  const above = image.sizes.find((s) => s.width >= 1024);
  const largest = image.sizes[image.sizes.length - 1];
  return (exact ?? above ?? largest)?.src;
}

/** The business as a schema.org AutomotiveBusiness. Only what settings actually hold is emitted. */
export function businessJsonLd(settings: SiteSettings, reviews: Review[] = []): JsonLdObject {
  const sameAs = Object.values(settings.socials).filter((u): u is string => typeof u === "string" && u.length > 0);
  const openingHours = settings.hoursSpec
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const rating =
    settings.googleRating && settings.googleReviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: settings.googleRating,
            reviewCount: settings.googleReviewCount,
            bestRating: 5,
          },
        }
      : {};
  return {
    "@type": "AutomotiveBusiness",
    "@id": BUSINESS_ID,
    name: settings.name,
    ...(settings.legalName ? { legalName: settings.legalName } : {}),
    url: `${SITE_URL}/`,
    image: absolute(OG.site),
    telephone: `+${settings.phoneDigits}`,
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.addressLine,
      addressLocality: settings.town,
      postalCode: settings.postcode,
      addressCountry: "GB",
    },
    ...(openingHours.length ? { openingHours } : {}),
    ...(settings.established ? { foundingDate: String(settings.established) } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...rating,
    ...(reviews.length
      ? {
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            reviewBody: r.text,
            ...(r.date ? { datePublished: r.date } : {}),
          })),
        }
      : {}),
  };
}

/** A reference to the business by id, for `provider` and `publisher` fields. */
export function businessRef(): JsonLdObject {
  return { "@type": "AutomotiveBusiness", "@id": BUSINESS_ID, name: SITE_NAME };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "en-GB",
    publisher: businessRef(),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

/** A service as a schema.org Service offered by the business. */
export function serviceEntity(s: Service, full = false): JsonLdObject {
  const src = shareSrc(s.image);
  return {
    "@type": "Service",
    "@id": absolute(`/services/${s.slug}`),
    name: s.title,
    url: absolute(`/services/${s.slug}`),
    serviceType: s.title,
    provider: businessRef(),
    areaServed: s.mobile ? "Wales" : "Tregaron",
    ...(src ? { image: absolute(src) } : {}),
    ...(s.promise ? { description: s.promise } : {}),
    ...(full && s.fromPriceGBP !== undefined
      ? {
          offers: {
            "@type": "Offer",
            price: s.fromPriceGBP,
            priceCurrency: "GBP",
            priceSpecification: { "@type": "PriceSpecification", minPrice: s.fromPriceGBP, priceCurrency: "GBP" },
          },
        }
      : {}),
  };
}

export function itemList(entities: JsonLdObject[]): JsonLdObject {
  return {
    "@type": "ItemList",
    numberOfItems: entities.length,
    itemListElement: entities.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })),
  };
}

/** Wrap one or more entities in a single `@context` document. */
export function graph(...entities: JsonLdObject[]): JsonLdObject {
  return { "@context": "https://schema.org", "@graph": entities };
}

/**
 * The serialised script body. `<` is escaped so authored text can never close the
 * script tag; JSON.parse reads the escape back as a plain character.
 */
export function jsonLd(obj: JsonLdObject) {
  const data = "@context" in obj ? obj : { "@context": "https://schema.org", ...obj };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
