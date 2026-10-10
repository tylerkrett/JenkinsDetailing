import { z } from "zod";

/**
 * Single source of truth for site content. Shared by the JSON reader, the build-time
 * image pipeline and the CMS config generator, so the three can never drift.
 *
 * Collections: settings (one object), services, packages, process steps, work
 * (job photos, optionally before and after), reviews and page copy. Nothing here is for sale.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case");

/**
 * A path inside public/photos, one folder deep at most (`process/wash.jpg`), never a
 * URL. The CMS image widget stores the public path (`/photos/process/wash.jpg`); that
 * prefix is accepted and stripped so every consumer sees the same folder-relative name.
 */
const imageFile = z
  .string()
  .regex(
    /^(?:\/photos\/)?(?:[\w-]+\/)?[\w.-]+\.(jpe?g|png|webp)$/i,
    "must be a file in public/photos, e.g. process/wash.jpg",
  )
  .transform((file) => file.replace(/^\/photos\//, ""));

/** A pound amount in whole pounds. Prices on the site are shown as "from £N". */
const pounds = z.number().int().nonnegative();

/** A processed image: every size the build emitted plus what the pages need. */
export const processedImageSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspect: z.number().positive(),
  dominantColor: z.string().regex(/^#[0-9a-f]{6}$/),
  /** Tiny inline WebP shown while the real image decodes. */
  lqip: z.string().startsWith("data:image/"),
  /** Ascending by width; the last entry is the largest available (never upscaled). */
  sizes: z
    .array(
      z.object({
        width: z.number().int().positive(),
        src: z.string().startsWith("/photos-derived/"),
      }),
    )
    .min(1),
});

function uniqueSlugs<T extends { slug: string }>(items: T[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [i, "slug"],
        message: `duplicate slug "${item.slug}"`,
      });
    }
    seen.add(item.slug);
  });
}

// ---------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------

export const settingsSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().default(""),
  /** Companies House number, registered office and VAT number for the footer and legal pages. */
  companyNumber: z.string().default(""),
  registeredOffice: z.string().default(""),
  vatNumber: z.string().default(""),
  tagline: z.string().default(""),
  /** How soon a quote request is answered, shown beside the form and the quote buttons. */
  replyPromise: z.string().default("We reply with a price and the earliest date, usually the same day."),
  /** Facts for the strip under the home hero, e.g. `4,000 kg` / `Dedicated underbody lift`. */
  stats: z
    .array(z.object({ label: z.string().min(1), value: z.string().min(1) }))
    .max(4)
    .default([]),
  /** The one-line promise on the home page. */
  promise: z.string().default(""),
  addressLine: z.string().min(1),
  town: z.string().min(1),
  postcode: z.string().min(1),
  /** Displayed as written, e.g. "07805 538 687". */
  phone: z.string().min(1),
  /** International digits only for wa.me and tel: links, e.g. "447805538687". */
  phoneDigits: z.string().regex(/^\d{8,15}$/),
  email: z.string().email(),
  /** Plain text, one line per day or range, shown as written. */
  hoursText: z.string().default(""),
  /** schema.org openingHours strings, one per line, e.g. "Mo-Fr 09:00-17:00". */
  hoursSpec: z.string().default(""),
  directionsUrl: z.string().url().optional(),
  established: z.number().int().min(1800).max(2100).default(2013),
  carproApproved: z.boolean().default(true),
  googleRating: z.number().min(0).max(5).optional(),
  googleReviewCount: z.number().int().nonnegative().optional(),
  portrait: imageFile.optional(),
  unitPhoto: imageFile.optional(),
  socials: z
    .object({
      instagram: z.string().url().optional(),
      facebook: z.string().url().optional(),
    })
    .default({}),
});

/** Settings after the pipeline: the two optional photos processed. */
export const settingsGeneratedSchema = settingsSchema
  .omit({ portrait: true, unitPhoto: true })
  .extend({
    portrait: processedImageSchema.optional(),
    unitPhoto: processedImageSchema.optional(),
  });

// ---------------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------------

export const serviceInputSchema = z.object({
  slug,
  title: z.string().min(1),
  /** One line under the title everywhere the service is listed. */
  promise: z.string().default(""),
  /** Plain text; blank lines separate paragraphs. */
  description: z.string().default(""),
  fromPriceGBP: pounds.optional(),
  /** "plus VAT", "depends on size and condition", and so on. */
  priceNote: z.string().default(""),
  /** What is included, one item per line. */
  includes: z.array(z.string().min(1)).default([]),
  /** Questions people ask about this service, answered on its page. */
  faq: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).default([]),
  duration: z.string().default(""),
  guarantee: z.string().default(""),
  /** Available at the customer's door as well as at the unit. */
  mobile: z.boolean().default(false),
  image: imageFile.optional(),
  gallery: z.array(imageFile).default([]),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export const servicesInputSchema = z.array(serviceInputSchema).superRefine(uniqueSlugs);

export const serviceSchema = serviceInputSchema
  .omit({ image: true, gallery: true })
  .extend({
    /** The service's photo, or its still from the bay when it has none. */
    image: processedImageSchema.optional(),
    /** Always the still from the bay, so a page can avoid showing one photo twice. */
    still: processedImageSchema.optional(),
    gallery: z.array(processedImageSchema),
  });

// ---------------------------------------------------------------------------------
// Packages (paint correction tiers)
// ---------------------------------------------------------------------------------

export const packageSchema = z.object({
  slug,
  name: z.string().min(1),
  /** Slug of the service this package belongs to. */
  service: slug,
  summary: z.string().default(""),
  priceGBP: pounds.optional(),
  priceNote: z.string().default(""),
  /** Machine polishing stages. */
  stages: z.number().int().min(0).max(5).default(1),
  /** What the package includes, one item per line. */
  steps: z.array(z.string().min(1)).default([]),
  sortOrder: z.number().int().default(0),
});
export const packagesSchema = z.array(packageSchema).superRefine(uniqueSlugs);

// ---------------------------------------------------------------------------------
// Process steps: the acts of the scene, and the DOM process page
// ---------------------------------------------------------------------------------

export const processStepInputSchema = z.object({
  slug,
  /** Which act of the scene this step narrates, 1 to 7. */
  act: z.number().int().min(1).max(7),
  title: z.string().min(1),
  /** What is being done, one line. */
  what: z.string().min(1),
  /** Why it is done, one line, in the detailer's voice. */
  why: z.string().min(1),
  /** Longer plain text for the process page. */
  text: z.string().default(""),
  /** Slug of the service this step links to. */
  service: slug.optional(),
  /** A frame from the bay for the home page's step tiles; defaults to `acts/<slug>.jpg`. */
  still: imageFile.optional(),
  image: imageFile.optional(),
  sortOrder: z.number().int().default(0),
});
export const processInputSchema = z.array(processStepInputSchema).superRefine(uniqueSlugs);

export const processStepSchema = processStepInputSchema.omit({ image: true, still: true }).extend({
  /** Position in the sequence, 0-based. */
  index: z.number().int().nonnegative(),
  image: processedImageSchema.optional(),
  still: processedImageSchema.optional(),
});

// ---------------------------------------------------------------------------------
// Work: before and after pairs
// ---------------------------------------------------------------------------------

export const workInputSchema = z.object({
  slug,
  title: z.string().min(1),
  /** Slug of the service the job was. */
  service: slug.optional(),
  vehicle: z.string().default(""),
  /** Optional: with `after`, a before-and-after pair. Without it, a finished-job photo. */
  before: imageFile.optional(),
  after: imageFile,
  caption: z.string().default(""),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export const workListInputSchema = z.array(workInputSchema).superRefine(uniqueSlugs);

export const workSchema = workInputSchema
  .omit({ before: true, after: true })
  .extend({ before: processedImageSchema.optional(), after: processedImageSchema });

// ---------------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------------

export const reviewSourceSchema = z.enum(["google", "facebook", "direct"]);
export const reviewSchema = z.object({
  author: z.string().min(1),
  rating: z.number().int().min(1).max(5).default(5),
  text: z.string().min(1),
  source: reviewSourceSchema.default("google"),
  /** ISO date, YYYY-MM-DD. Optional. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
    .optional(),
  featured: z.boolean().default(false),
});
export const reviewsSchema = z.array(reviewSchema);

// ---------------------------------------------------------------------------------
// Page copy
// ---------------------------------------------------------------------------------

const pageCopy = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  /** Plain text intro or body; blank lines separate paragraphs. */
  intro: z.string().default(""),
});
export const pagesSchema = z.object({
  home: pageCopy.extend({
    /** The full-bleed photo behind the home headline. */
    heroImage: imageFile.optional(),
    /** An optional short muted loop over the hero photo, e.g. `/videos/reveal.mp4`. */
    heroVideo: z
      .string()
      .regex(/^\/videos\/[\w.-]+\.mp4$/)
      .optional(),
    headline: z.string().default(""),
    subline: z.string().default(""),
  }),
  services: pageCopy,
  process: pageCopy,
  work: pageCopy,
  about: pageCopy.extend({ story: z.string().default("") }),
  contact: pageCopy,
  privacy: pageCopy.extend({ body: z.string().default("") }),
  terms: pageCopy.extend({ body: z.string().default("") }),
  play: pageCopy,
});

export const pagesGeneratedSchema = pagesSchema.extend({
  home: pagesSchema.shape.home.omit({ heroImage: true }).extend({ heroImage: processedImageSchema.optional() }),
});

// ---------------------------------------------------------------------------------
// Quote request
// ---------------------------------------------------------------------------------

export const vehicleSizeSchema = z.enum(["small", "medium", "large", "van"]);
export const whereSchema = z.enum(["unit", "mobile"]);

export const quoteInputSchema = z.object({
  service: slug.optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  vehicle: z.string().trim().min(1).max(120),
  size: vehicleSizeSchema,
  where: whereSchema,
  postcode: z.string().trim().max(12).optional(),
  message: z.string().trim().min(10).max(4000),
});

export type ProcessedImage = z.infer<typeof processedImageSchema>;
export type SiteSettings = z.infer<typeof settingsGeneratedSchema>;
export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Package = z.infer<typeof packageSchema>;
export type ProcessStepInput = z.infer<typeof processStepInputSchema>;
export type ProcessStep = z.infer<typeof processStepSchema>;
export type WorkInput = z.infer<typeof workInputSchema>;
export type WorkPair = z.infer<typeof workSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewSource = z.infer<typeof reviewSourceSchema>;
export type SitePages = z.infer<typeof pagesGeneratedSchema>;
export type VehicleSize = z.infer<typeof vehicleSizeSchema>;
export type Where = z.infer<typeof whereSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
