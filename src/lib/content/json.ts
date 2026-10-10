import "server-only";
import type { z } from "zod";

import packagesJson from "../../../content/packages.json";
import pagesJson from "../../../content/pages.generated.json";
import processJson from "../../../content/process.generated.json";
import reviewsJson from "../../../content/reviews.json";
import servicesJson from "../../../content/services.generated.json";
import settingsJson from "../../../content/settings.generated.json";
import workJson from "../../../content/work.generated.json";
import {
  packagesSchema,
  pagesGeneratedSchema,
  type processStepSchema,
  reviewsSchema,
  type serviceSchema,
  type settingsGeneratedSchema,
  type workSchema,
} from "./schema";

// The JSON is inlined into the bundle at build time, so this never touches a filesystem,
// which Cloudflare Workers require. The generated files were validated against these
// same schemas by the pipeline that wrote them, so they are only typed here, not
// re-parsed; the small hand-written files are still checked.
const services = servicesJson as z.infer<typeof serviceSchema>[];
const process = processJson as z.infer<typeof processStepSchema>[];
const work = workJson as z.infer<typeof workSchema>[];
const settings = settingsJson as z.infer<typeof settingsGeneratedSchema>;
const packages = packagesSchema.parse(packagesJson).sort((a, b) => a.sortOrder - b.sortOrder);
const reviews = reviewsSchema.parse(reviewsJson);
const pages = pagesGeneratedSchema.parse(pagesJson);

export async function getServices() {
  return services;
}

export async function getService(slug: string) {
  return services.find((s) => s.slug === slug) ?? null;
}

export async function getPackages(service?: string) {
  return service ? packages.filter((p) => p.service === service) : packages;
}

export async function getProcess() {
  return process;
}

export async function getWork() {
  return work;
}

export async function getWorkPair(slug: string) {
  return work.find((w) => w.slug === slug) ?? null;
}

export async function getReviews() {
  return reviews;
}

export async function getSettings() {
  return settings;
}

export async function getPages() {
  return pages;
}
