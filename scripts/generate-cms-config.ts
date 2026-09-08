/**
 * Generates public/admin/config.yml (Sveltia CMS) from the Zod schemas in
 * src/lib/content/schema.ts, so field names, enums, defaults and validation can never
 * drift from what the build pipeline accepts. Runs as part of `pnpm content`.
 *
 * The schema decides *what* a field is (type, options, default, required); the
 * presentation maps below decide *how it reads* to the owner (label, hint, widget) and
 * in what order. Both must cover exactly the same keys; a mismatch fails loudly.
 *
 * Environment (all optional, see docs/cms.md):
 *   CMS_REPO             GitHub "owner/name" the CMS commits to
 *   CMS_AUTH_URL         URL of the deployed cms-auth Worker (config `backend.base_url`)
 *   NEXT_PUBLIC_SITE_URL public site URL, used for the "view site" link in the CMS
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  packageSchema,
  pagesSchema,
  processStepInputSchema,
  reviewSchema,
  serviceInputSchema,
  settingsSchema,
  workInputSchema,
} from "../src/lib/content/schema";

/** Must match the pinned script in public/admin/index.html. */
const SVELTIA_VERSION = "0.207.1";

const FALLBACK_REPO = "OWNER/REPO";
const FALLBACK_AUTH_URL = "https://jenkins-detailing-cms-auth.YOUR-SUBDOMAIN.workers.dev";

// The same env files Next loads for a production build, so NEXT_PUBLIC_SITE_URL here is
// the value the site is built with on every deploy path. Shell values win.
for (const file of [".env.production", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[1] && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
const REPO = process.env.CMS_REPO ?? FALLBACK_REPO;
const AUTH_URL = (process.env.CMS_AUTH_URL ?? FALLBACK_AUTH_URL).replace(/\/$/, "");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

const OUT = path.join(process.cwd(), "public", "admin", "config.yml");

// ---------------------------------------------------------------------------------
// Presentation: what Danny reads. Keys must match the schema exactly.
// ---------------------------------------------------------------------------------

type Widget = "string" | "text" | "image" | "color";

interface Presentation {
  label: string;
  hint?: string;
  /** Override the widget the schema type would pick (strings only). */
  widget?: Widget;
  /** Required for enum fields: a human label per allowed value. */
  optionLabels?: Record<string, string>;
  /** Nested object fields. */
  fields?: Record<string, Presentation>;
  /** Label for one item of a list field. */
  itemLabel?: string;
  /** Extra Sveltia options merged last (min, step, accept, pattern …). */
  extra?: Record<string, unknown>;
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const PHOTO = { accept: IMAGE_ACCEPT, choose_url: false };

const SLUG_HINT =
  "Lowercase words joined by hyphens, e.g. `paint-correction`. It becomes the page address " +
  "and must be unique. Do not change it once the page is live; links people have shared would stop working.";

const settingsPresentation: Record<keyof z.infer<typeof settingsSchema>, Presentation> = {
  name: { label: "Business name", hint: "Shown in the header and page titles." },
  legalName: { label: "Legal name", hint: "The limited company name for the footer, e.g. `Jenkins Detailing & Car Sales Ltd`." },
  companyNumber: { label: "Company number", hint: "Companies House number. Shown in the footer as the law requires." },
  registeredOffice: { label: "Registered office", hint: "One line. Shown in the footer." },
  vatNumber: { label: "VAT number", hint: "Optional." },
  tagline: { label: "Tagline", hint: "One short line, used on the About page and in share cards." },
  promise: { label: "Promise", hint: "The one line at the top of the home page." },
  addressLine: { label: "Address line", hint: "e.g. `Rose Garage, Dewi Road`." },
  town: { label: "Town" },
  postcode: { label: "Postcode" },
  phone: { label: "Phone, as shown", hint: "Written the way you want it displayed, e.g. `07805 538 687`." },
  phoneDigits: {
    label: "Phone, digits only",
    hint: "International format with no spaces or plus, e.g. `447805538687`. Used for WhatsApp and tap-to-call.",
    extra: { pattern: ["^\\d{8,15}$", "Digits only, starting with the country code, e.g. 447805538687"] },
  },
  email: { label: "Email", hint: "Where quote requests are sent and the address shown on the site." },
  hoursText: { label: "Opening hours", widget: "text", hint: "As you want them shown, one line per day or range." },
  hoursSpec: {
    label: "Opening hours for search engines",
    widget: "text",
    hint: "One per line in this exact form: `Mo-Fr 09:00-17:00`, `Sa 09:00-15:00`. Leave empty if unsure.",
  },
  directionsUrl: { label: "Directions link", hint: "A Google Maps link to the unit. Optional." },
  established: { label: "Established", hint: "The year Jenkins Detailing started.", extra: { step: 1 } },
  carproApproved: { label: "CarPro approved detailing centre", hint: "Shows the CarPro mark when ticked." },
  googleRating: { label: "Google rating", hint: "e.g. `4.8`. Leave empty to hide the rating.", extra: { step: 0.1 } },
  googleReviewCount: { label: "Google review count", hint: "The number of reviews the rating is based on." },
  portrait: { label: "Portrait photo", hint: "Danny, for the About page.", extra: PHOTO },
  unitPhoto: { label: "Unit photo", hint: "The bay or the forecourt, for the contact page.", extra: PHOTO },
  socials: {
    label: "Social links",
    hint: "Full web addresses. Leave any of them empty to hide it.",
    fields: { instagram: { label: "Instagram" }, facebook: { label: "Facebook" } },
  },
};

const servicePresentation: Record<keyof z.infer<typeof serviceInputSchema>, Presentation> = {
  title: { label: "Title" },
  slug: { label: "Web address", hint: SLUG_HINT },
  promise: { label: "One line", hint: "Shown under the title wherever the service is listed." },
  description: { label: "Description", widget: "text", hint: "Plain sentences. Blank lines separate paragraphs." },
  fromPriceGBP: { label: "From price (£)", hint: "Whole pounds. Leave empty when a price needs an inspection first.", extra: { step: 1 } },
  priceNote: { label: "Price note", widget: "text", hint: "e.g. `Priced on inspection` or the full price list for the service." },
  includes: { label: "What is included", itemLabel: "Item", hint: "One item per line." },
  duration: { label: "How long it takes", hint: "e.g. `One to three days`." },
  guarantee: { label: "Guarantee", hint: "Optional." },
  mobile: { label: "Available at the customer's door" },
  image: { label: "Main photo", hint: "Optional. Shown on the service page and in its share card.", extra: PHOTO },
  gallery: { label: "More photos", itemLabel: "Photo", extra: PHOTO },
  featured: { label: "Featured", hint: "Featured services appear on the home page." },
  published: { label: "Show on the site", hint: "Untick to keep a draft." },
  sortOrder: { label: "Position", hint: "Lower numbers come first. Use tens (10, 20, 30) so you can slot one in later.", extra: { step: 1 } },
};

const packagePresentation: Record<keyof z.infer<typeof packageSchema>, Presentation> = {
  name: { label: "Name", hint: "e.g. `Silver`." },
  slug: { label: "Web address", hint: SLUG_HINT },
  service: { label: "Service", hint: "The web address of the service this package belongs to, e.g. `paint-correction`." },
  summary: { label: "Summary", widget: "text", hint: "Two sentences on who it is for." },
  priceGBP: { label: "Price (£)", hint: "Whole pounds. Leave empty for `priced on inspection`.", extra: { step: 1 } },
  priceNote: { label: "Price note" },
  stages: { label: "Polishing stages", extra: { step: 1 } },
  steps: { label: "Steps", itemLabel: "Step", hint: "One per line, in order." },
  sortOrder: { label: "Position", extra: { step: 1 } },
};

const processPresentation: Record<keyof z.infer<typeof processStepInputSchema>, Presentation> = {
  title: { label: "Title" },
  slug: { label: "Web address", hint: SLUG_HINT },
  act: { label: "Act", hint: "Which stop of the 3D scene this step narrates, 1 to 7, in order.", extra: { step: 1 } },
  what: { label: "What is done", hint: "One line, shown in the scene." },
  why: { label: "Why it is done", hint: "One line, in your own words, shown in the scene under the what." },
  text: { label: "Longer text", widget: "text", hint: "For the process page. Blank lines separate paragraphs." },
  service: { label: "Links to service", hint: "The web address of the service this step belongs to, e.g. `detailing`." },
  image: { label: "Photo", hint: "A real photo of this step. Optional.", extra: PHOTO },
  sortOrder: { label: "Position", extra: { step: 1 } },
};

const workPresentation: Record<keyof z.infer<typeof workInputSchema>, Presentation> = {
  title: { label: "Title", hint: "e.g. `Audi S5, two-stage correction`." },
  slug: { label: "Web address", hint: SLUG_HINT },
  service: { label: "Service", hint: "The web address of the service, e.g. `paint-correction`." },
  vehicle: { label: "Vehicle", hint: "Make and model. Optional." },
  before: { label: "Before photo", hint: "Same angle as the after photo if you can.", extra: PHOTO },
  after: { label: "After photo", extra: PHOTO },
  caption: { label: "Caption", widget: "text", hint: "What was done, in a sentence or two." },
  featured: { label: "Featured", hint: "Featured pairs appear on the home page." },
  published: { label: "Show on the site" },
  sortOrder: { label: "Position", extra: { step: 1 } },
};

const reviewPresentation: Record<keyof z.infer<typeof reviewSchema>, Presentation> = {
  author: { label: "Name", hint: "First name and initial is enough." },
  rating: { label: "Stars", extra: { step: 1 } },
  text: { label: "Review", widget: "text" },
  source: { label: "Where from", optionLabels: { google: "Google", facebook: "Facebook", direct: "Direct" } },
  date: { label: "Date", hint: "YYYY-MM-DD. Optional." },
  featured: { label: "Featured", hint: "Featured reviews appear on the home page." },
};

const pageCopyFields = (extra: Record<string, Presentation> = {}): Record<string, Presentation> => ({
  title: { label: "Title", hint: "The page heading and browser title." },
  description: { label: "Description", widget: "text", hint: "One or two sentences for search results and share cards." },
  intro: { label: "Intro", widget: "text", hint: "Shown under the heading. Optional." },
  ...extra,
});

const pagesPresentation: Record<keyof z.infer<typeof pagesSchema>, Presentation> = {
  home: {
    label: "Home",
    fields: pageCopyFields({
      headline: { label: "Headline", hint: "The big line over the scene." },
      subline: { label: "Subline", hint: "One line under the headline." },
    }),
  },
  services: { label: "Services page", fields: pageCopyFields() },
  process: { label: "Process page", fields: pageCopyFields() },
  work: { label: "Work page", fields: pageCopyFields() },
  about: { label: "About page", fields: pageCopyFields({ story: { label: "Story", widget: "text", hint: "Blank lines separate paragraphs." } }) },
  contact: { label: "Contact page", fields: pageCopyFields() },
  privacy: { label: "Privacy page", fields: pageCopyFields({ body: { label: "Policy", widget: "text" } }) },
  terms: { label: "Terms page", fields: pageCopyFields({ body: { label: "Terms", widget: "text" } }) },
  play: { label: "Game page", fields: pageCopyFields() },
};

// ---------------------------------------------------------------------------------
// Zod introspection
// ---------------------------------------------------------------------------------

interface Unwrapped {
  base: z.ZodTypeAny;
  required: boolean;
  defaultValue: unknown;
  hasDefault: boolean;
}

function unwrap(schema: z.ZodTypeAny): Unwrapped {
  let base = schema;
  let required = true;
  let hasDefault = false;
  let defaultValue: unknown;
  for (;;) {
    if (base instanceof z.ZodDefault) {
      const def = base._def as {
        defaultValue: () => unknown;
        innerType: z.ZodTypeAny;
      };
      hasDefault = true;
      defaultValue = def.defaultValue();
      base = def.innerType;
    } else if (base instanceof z.ZodOptional || base instanceof z.ZodNullable) {
      required = false;
      base = (base._def as { innerType: z.ZodTypeAny }).innerType;
    } else if (base instanceof z.ZodEffects) {
      base = (base._def as { schema: z.ZodTypeAny }).schema;
    } else if (base instanceof z.ZodUnion) {
      // `z.union([z.literal(""), realSchema])` — the "" branch is the CMS's empty value.
      const options = (base._def as { options: z.ZodTypeAny[] }).options;
      const real = options.filter((o) => !(o instanceof z.ZodLiteral));
      if (real.length !== 1 || !real[0])
        throw new Error("unsupported union in schema");
      required = false;
      base = real[0];
    } else {
      break;
    }
  }
  const emptyDefault =
    hasDefault &&
    (defaultValue === "" ||
      defaultValue === null ||
      (Array.isArray(defaultValue) && defaultValue.length === 0) ||
      (typeof defaultValue === "object" &&
        defaultValue !== null &&
        Object.keys(defaultValue).length === 0));
  return {
    base,
    required: required && !emptyDefault,
    defaultValue,
    hasDefault,
  };
}

type StringCheck = {
  kind: string;
  value?: unknown;
  regex?: RegExp;
  message?: string;
};
type NumberCheck = { kind: string; value?: number; inclusive?: boolean };

function stringOptions(s: z.ZodString): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const check of (s._def as { checks: StringCheck[] }).checks) {
    switch (check.kind) {
      case "email":
        out.type = "email";
        break;
      case "url":
        out.type = "url";
        break;
      case "min":
        out.minlength = check.value;
        break;
      case "max":
        out.maxlength = check.value;
        break;
      case "length":
        out.minlength = check.value;
        out.maxlength = check.value;
        break;
      case "regex":
        if (check.regex) {
          out.pattern = [
            check.regex.source,
            check.message ?? "Not in the expected format",
          ];
        }
        break;
      default:
        break; // trim / toUpperCase etc. are transforms the pipeline applies itself
    }
  }
  return out;
}

function numberOptions(n: z.ZodNumber): Record<string, unknown> {
  const out: Record<string, unknown> = { value_type: "float" };
  for (const check of (n._def as { checks: NumberCheck[] }).checks) {
    if (check.kind === "int") out.value_type = "int";
    // Sveltia's min/max are inclusive; exclusive bounds are expressed via `extra`.
    if (check.kind === "min" && check.inclusive && check.value !== undefined)
      out.min = check.value;
    if (check.kind === "max" && check.inclusive && check.value !== undefined)
      out.max = check.value;
  }
  return out;
}

function isImageFile(schema: z.ZodTypeAny): boolean {
  const { base } = unwrap(schema);
  if (!(base instanceof z.ZodString)) return false;
  // The `imageFile` schema is the only string whose regex lists image extensions.
  return (base._def as { checks: StringCheck[] }).checks.some(
    (c) => c.kind === "regex" && (c.regex?.source ?? "").includes("jpe?g|png"),
  );
}

/** Build one Sveltia field definition from a Zod field plus its presentation. */
function buildField(
  name: string,
  schema: z.ZodTypeAny,
  p: Presentation,
): Record<string, unknown> {
  const { base, required, defaultValue, hasDefault } = unwrap(schema);
  const field: Record<string, unknown> = { name, label: p.label };
  if (p.hint) field.hint = p.hint;
  // Extra options apply to the field itself, except for lists where they describe the item.
  let extra = p.extra ?? {};

  if (base instanceof z.ZodString) {
    const widget: Widget =
      p.widget ?? (isImageFile(schema) ? "image" : "string");
    field.widget = widget;
    if (widget === "string" || widget === "text")
      Object.assign(field, stringOptions(base));
  } else if (base instanceof z.ZodNumber) {
    field.widget = "number";
    Object.assign(field, numberOptions(base));
  } else if (base instanceof z.ZodBoolean) {
    field.widget = "boolean";
  } else if (base instanceof z.ZodEnum) {
    const values = (base._def as { values: string[] }).values;
    const labels = p.optionLabels ?? {};
    const missing = values.filter((v) => !(v in labels));
    const stale = Object.keys(labels).filter((v) => !values.includes(v));
    if (missing.length || stale.length) {
      throw new Error(
        `option labels for "${name}" out of sync — missing: [${missing.join(", ")}] stale: [${stale.join(", ")}]`,
      );
    }
    field.widget = "select";
    field.options = values.map((value) => ({ label: labels[value], value }));
  } else if (base instanceof z.ZodArray) {
    const element = (base._def as { type: z.ZodTypeAny }).type;
    const image = isImageFile(element);
    if (!image && !(unwrap(element).base instanceof z.ZodString))
      throw new Error(`unsupported array element for "${name}"`);
    field.widget = "list";
    field.label_singular = p.itemLabel ?? p.label.replace(/s$/, "");
    field.field = {
      name: image ? "file" : "item",
      label: p.itemLabel ?? p.label.replace(/s$/, ""),
      widget: image ? "image" : "string",
      ...extra,
    };
    extra = {};
  } else if (base instanceof z.ZodObject) {
    if (!p.fields)
      throw new Error(`"${name}" is an object but has no nested presentation`);
    field.widget = "object";
    field.fields = buildFields(base as z.ZodObject<z.ZodRawShape>, p.fields);
  } else {
    throw new Error(
      `unsupported schema type for "${name}": ${base.constructor.name}`,
    );
  }

  if (!required) field.required = false;
  if (
    hasDefault &&
    required &&
    field.widget !== "list" &&
    field.widget !== "object"
  ) {
    field.default = defaultValue;
  }
  if (field.widget === "boolean" && hasDefault) field.default = defaultValue;
  return { ...field, ...extra };
}

function buildFields(
  schema: z.ZodObject<z.ZodRawShape>,
  presentation: Record<string, Presentation>,
): Record<string, unknown>[] {
  const shape = schema.shape;
  const schemaKeys = Object.keys(shape);
  const presentationKeys = Object.keys(presentation);
  const missing = schemaKeys.filter((k) => !presentationKeys.includes(k));
  const stale = presentationKeys.filter((k) => !schemaKeys.includes(k));
  if (missing.length || stale.length) {
    throw new Error(
      `presentation out of sync with schema — missing: [${missing.join(", ")}] stale: [${stale.join(", ")}]`,
    );
  }
  // Presentation order is display order; the schema only decides the set of fields.
  return presentationKeys.map((key) => {
    const fieldSchema = shape[key];
    const p = presentation[key];
    if (!fieldSchema || !p)
      throw new Error(`no schema/presentation for "${key}"`);
    return buildField(key, fieldSchema, p);
  });
}

// ---------------------------------------------------------------------------------
// Config assembly
// ---------------------------------------------------------------------------------

/** A JSON file whose root is an array: one `list` field with `root: true`. */
function rootListFile(opts: {
  name: string;
  label: string;
  labelSingular: string;
  file: string;
  summary: string;
  schema: z.ZodObject<z.ZodRawShape>;
  presentation: Record<string, Presentation>;
}) {
  return {
    name: opts.name,
    label: opts.label,
    file: opts.file,
    format: "json",
    fields: [
      {
        name: opts.name,
        label: opts.label,
        label_singular: opts.labelSingular,
        widget: "list",
        root: true,
        summary: opts.summary,
        collapsed: true,
        minimize_collapsed: false,
        allow_reorder: true,
        fields: buildFields(opts.schema, opts.presentation),
      },
    ],
  };
}

function buildConfig() {
  const config: Record<string, unknown> = {
    backend: { name: "github", repo: REPO, branch: "main", base_url: AUTH_URL },
    media_folder: "/public/photos",
    public_folder: "/photos",
    ...(SITE_URL ? { site_url: SITE_URL, display_url: SITE_URL } : {}),
    show_preview_links: false,
    editor: { preview: false },
    output: {
      // Empty optional fields are left out of the JSON so the pipeline's Zod defaults
      // apply, instead of `null` / "" landing in the file.
      omit_empty_optional_fields: true,
      json: { indent_style: "space", indent_size: 2 },
    },
    collections: [
      {
        name: "services",
        label: "Services",
        icon: "car_repair",
        description: "Every service you offer. Drag to reorder or set a Position; untick “Show on the site” to keep a draft.",
        media_folder: "/public/photos/services",
        public_folder: "/photos/services",
        files: [
          rootListFile({ name: "services", label: "Services", labelSingular: "Service", file: "content/services.json", summary: "{{title}}", schema: serviceInputSchema, presentation: servicePresentation }),
        ],
      },
      {
        name: "packages",
        label: "Packages",
        icon: "workspace_premium",
        description: "The paint correction tiers.",
        files: [
          rootListFile({ name: "packages", label: "Packages", labelSingular: "Package", file: "content/packages.json", summary: "{{name}}", schema: packageSchema, presentation: packagePresentation }),
        ],
      },
      {
        name: "process",
        label: "The process",
        icon: "route",
        description: "The steps of the job, in order. Each one is a stop in the 3D scene: what is done and why.",
        media_folder: "/public/photos/process",
        public_folder: "/photos/process",
        files: [
          rootListFile({ name: "process", label: "Steps", labelSingular: "Step", file: "content/process.json", summary: "{{act}}. {{title}}", schema: processStepInputSchema, presentation: processPresentation }),
        ],
      },
      {
        name: "work",
        label: "Before and after",
        icon: "compare",
        description: "Pairs of photos of real jobs.",
        media_folder: "/public/photos/work",
        public_folder: "/photos/work",
        files: [
          rootListFile({ name: "work", label: "Pairs", labelSingular: "Pair", file: "content/work.json", summary: "{{title}}", schema: workInputSchema, presentation: workPresentation }),
        ],
      },
      {
        name: "reviews",
        label: "Reviews",
        icon: "reviews",
        description: "Reviews you are happy to quote, with the customer's permission.",
        files: [
          rootListFile({ name: "reviews", label: "Reviews", labelSingular: "Review", file: "content/reviews.json", summary: "{{author}}", schema: reviewSchema, presentation: reviewPresentation }),
        ],
      },
      {
        name: "pages",
        label: "Page copy",
        icon: "article",
        description: "Headings, descriptions and text for each page.",
        files: [
          { name: "pages", label: "Page copy", file: "content/pages.json", format: "json", fields: buildFields(pagesSchema, pagesPresentation) },
        ],
      },
      {
        name: "settings",
        label: "Business details",
        icon: "settings",
        description: "Name, address, phone, hours, socials and the company details for the footer.",
        media_folder: "/public/photos/about",
        public_folder: "/photos/about",
        files: [
          { name: "settings", label: "Business details", file: "content/settings.json", format: "json", fields: buildFields(settingsSchema, settingsPresentation) },
        ],
      },
    ],
  };
  return config;
}

// ---------------------------------------------------------------------------------
// Minimal YAML emitter (no dependency). Strings are always double-quoted so no value
// can be misread as a number, bool or anchor.
// ---------------------------------------------------------------------------------

function yamlKey(key: string) {
  return /^[A-Za-z_][\w-]*$/.test(key) ? key : JSON.stringify(key);
}

function yamlScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  throw new Error(`not a scalar: ${typeof value}`);
}

function isScalar(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function yamlLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return ["[]"];
    return value.flatMap((item) => {
      if (isScalar(item)) return [`- ${yamlScalar(item)}`];
      const [first, ...rest] = yamlLines(item);
      return [`- ${first ?? ""}`, ...rest.map((l) => `  ${l}`)];
    });
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return ["{}"];
    return entries.flatMap(([k, v]) => {
      if (isScalar(v)) return [`${yamlKey(k)}: ${yamlScalar(v)}`];
      const nested = yamlLines(v);
      if (nested.length === 1 && (nested[0] === "[]" || nested[0] === "{}")) {
        return [`${yamlKey(k)}: ${nested[0]}`];
      }
      return [`${yamlKey(k)}:`, ...nested.map((l) => `  ${l}`)];
    });
  }
  return [yamlScalar(value)];
}


async function main() {
  const usingFallbacks: string[] = [];
  if (REPO === FALLBACK_REPO) usingFallbacks.push("CMS_REPO");
  if (AUTH_URL === FALLBACK_AUTH_URL) usingFallbacks.push("CMS_AUTH_URL");

  const header = [
    `# yaml-language-server: $schema=https://unpkg.com/@sveltia/cms@${SVELTIA_VERSION}/schema/sveltia-cms.json`,
    "#",
    "# GENERATED by scripts/generate-cms-config.ts from src/lib/content/schema.ts. Do not edit.",
    "# Regenerate with `pnpm cms:config` (also runs as part of `pnpm content`, i.e. every build).",
    "#",
    "# backend.repo     <- env CMS_REPO      (GitHub owner/name this CMS commits to)",
    "# backend.base_url <- env CMS_AUTH_URL  (the deployed cms-auth Worker, see docs/cms.md)",
    ...(usingFallbacks.length
      ? [`# WARNING: placeholder values in use for ${usingFallbacks.join(", ")}; sign-in will not work until set.`]
      : []),
    "",
  ];
  const body = yamlLines(buildConfig()).join("\n");
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, header.join("\n") + body + "\n");
  console.log(
    `  ✓ ${path.relative(process.cwd(), OUT)} generated` +
      (usingFallbacks.length ? `  (placeholders: ${usingFallbacks.join(", ")})` : ""),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
