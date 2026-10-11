import type { Metadata } from "next";

import { env } from "~/env";
import type { Package, ProcessedImage, Review, Service, SiteSettings } from "~/lib/content";

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

/** The owner: named in the About copy and on WhatsApp ("Hi Danny"), but not a setting. */
export const OWNER = "Danny Jenkins";

/** The square app icon: the logo search engines accept (the wordmark is under their 112 px minimum). */
const LOGO = { src: "/icons/icon-512.png", size: 512 } as const;

/** Where the work happens: the unit in Tregaron, its county, and at the door across Wales (see About). */
const PLACES = {
  tregaron: { "@type": "City", name: "Tregaron" },
  ceredigion: { "@type": "AdministrativeArea", name: "Ceredigion" },
  wales: { "@type": "AdministrativeArea", name: "Wales" },
} as const;

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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_CODES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Structured opening hours from the settings' compact lines ("Mo-Fr 09:00-17:00",
 * "Sa,Su 10:00-14:00"). A line that does not parse is left out rather than guessed at.
 */
export function openingHoursSpecification(lines: string[]): JsonLdObject[] {
  return lines.flatMap((line) => {
    const match = /^([A-Za-z,-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(line);
    if (!match) return [];
    const [, dayList = "", opens, closes] = match;
    const dayOfWeek = dayList.split(",").flatMap((part) => {
      const [from = "", to = from] = part.split("-");
      const a = DAY_CODES.indexOf(from);
      const b = DAY_CODES.indexOf(to);
      return a < 0 || b < a ? [] : DAYS.slice(a, b + 1);
    });
    return dayOfWeek.length ? [{ "@type": "OpeningHoursSpecification", dayOfWeek, opens, closes }] : [];
  });
}

/**
 * The business as a schema.org AutomotiveBusiness: what search engines and AI agents read
 * to answer where it is, when it is open, what it does and roughly what it costs. Only what
 * the content actually holds is emitted, so there are no reviews until real ones are added.
 * Pass the services to include the priced catalogue.
 */
export function businessJsonLd(settings: SiteSettings, reviews: Review[] = [], services: Service[] = []): JsonLdObject {
  const sameAs = Object.values(settings.socials).filter((u): u is string => typeof u === "string" && u.length > 0);
  const openingHours = settings.hoursSpec
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const hours = openingHoursSpecification(openingHours);
  const prices = services.flatMap((s) => (s.fromPriceGBP === undefined ? [] : [s.fromPriceGBP]));
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
    description: SITE_DESCRIPTION,
    ...(settings.tagline ? { slogan: settings.tagline } : {}),
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: absolute(LOGO.src), width: LOGO.size, height: LOGO.size },
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
    ...(settings.directionsUrl ? { hasMap: settings.directionsUrl } : {}),
    areaServed: [PLACES.tregaron, PLACES.ceredigion, PLACES.wales],
    ...(openingHours.length ? { openingHours } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(prices.length ? { priceRange: `From £${Math.min(...prices)}` } : {}),
    currenciesAccepted: "GBP",
    founder: { "@type": "Person", name: OWNER },
    ...(settings.established ? { foundingDate: String(settings.established) } : {}),
    // How to ask for a price: the quote form, the phone, the inbox, and when someone answers.
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: `+${settings.phoneDigits}`,
      email: settings.email,
      url: absolute("/contact"),
      ...(hours.length ? { hoursAvailable: hours } : {}),
    },
    ...(settings.carproApproved
      ? {
          hasCredential: {
            "@type": "EducationalOccupationalCredential",
            name: "CarPro approved detailing centre",
            recognizedBy: { "@type": "Organization", name: "CarPro" },
          },
        }
      : {}),
    ...(services.length
      ? {
          knowsAbout: services.map((s) => s.title),
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Detailing services",
            itemListElement: services.map((s) =>
              serviceOffer(s, { "@type": "Service", "@id": serviceId(s.slug), name: s.title, url: serviceUrl(s.slug) }),
            ),
          },
        }
      : {}),
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

export function breadcrumbs(items: { name: string; path: string }[], id?: string): JsonLdObject {
  return {
    "@type": "BreadcrumbList",
    ...(id ? { "@id": id } : {}),
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

const serviceUrl = (slug: string) => absolute(`/services/${slug}`);
/** The service itself; its page's URL is the page's own id. */
const serviceId = (slug: string) => `${serviceUrl(slug)}#service`;

/**
 * What a service costs, as far as the content says: its "from" price when it has one, and
 * its price note either way, which holds the real figures ("£50 per vehicle", "plus VAT").
 */
function serviceOffer(s: Service, itemOffered?: JsonLdObject): JsonLdObject {
  return {
    "@type": "Offer",
    ...(itemOffered ? { itemOffered } : {}),
    url: serviceUrl(s.slug),
    priceCurrency: "GBP",
    ...(s.fromPriceGBP !== undefined
      ? {
          price: s.fromPriceGBP,
          priceSpecification: {
            "@type": "PriceSpecification",
            minPrice: s.fromPriceGBP,
            priceCurrency: "GBP",
            ...(/plus VAT/i.test(s.priceNote) ? { valueAddedTaxIncluded: false } : {}),
          },
        }
      : {}),
    ...(s.priceNote ? { description: s.priceNote } : {}),
  };
}

/**
 * A service as a schema.org Service offered by the business, with what it costs. `full`
 * (the service's own page) carries the whole description and its packages.
 */
export function serviceEntity(s: Service, full = false, packages: Package[] = []): JsonLdObject {
  const src = shareSrc(s.image);
  const description = full ? s.description || s.promise : s.promise;
  return {
    "@type": "Service",
    "@id": serviceId(s.slug),
    name: s.title,
    url: serviceUrl(s.slug),
    serviceType: s.title,
    provider: businessRef(),
    areaServed: s.mobile ? PLACES.wales : PLACES.tregaron,
    // "dynamic": done at the customer's door as well as at the unit.
    providerMobility: s.mobile ? "dynamic" : "static",
    ...(src ? { image: absolute(src) } : {}),
    ...(description ? { description } : {}),
    offers: serviceOffer(s),
    ...(full && packages.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `${s.title} packages`,
            itemListElement: packages.map((p) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: `${s.title}: ${p.name}`,
                ...(p.summary ? { description: p.summary } : {}),
              },
              priceCurrency: "GBP",
              ...(p.priceGBP !== undefined ? { price: p.priceGBP } : {}),
              ...(p.priceNote ? { description: p.priceNote } : {}),
            })),
          },
        }
      : {}),
  };
}

/**
 * A service's own page: an FAQPage when the service has questions (the same ones the page
 * shows), a plain WebPage otherwise. Either way it is about the service, inside the site.
 */
export function servicePageJsonLd(s: Service, name: string): JsonLdObject {
  const url = serviceUrl(s.slug);
  const page = {
    "@id": url,
    url,
    name,
    inLanguage: "en-GB",
    isPartOf: { "@id": WEBSITE_ID },
    breadcrumb: { "@id": `${url}#breadcrumb` },
  };
  if (!s.faq.length) return { "@type": "WebPage", ...page, mainEntity: { "@id": serviceId(s.slug) } };
  return {
    "@type": "FAQPage",
    ...page,
    about: { "@id": serviceId(s.slug) },
    mainEntity: s.faq.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
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
