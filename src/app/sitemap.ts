import type { MetadataRoute } from "next";

import { getServices, getWork } from "~/lib/content";
import { OG, SITE_URL, absolute, shareSrc } from "~/lib/seo";

/** Fixed per build so the sitemap does not change on every request. */
const lastModified = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, work] = await Promise.all([getServices(), getWork()]);
  const base = SITE_URL;
  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/services`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    ...services.map((s) => ({
      url: `${base}/services/${s.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: [shareSrc(s.image), OG.service(s.slug)].flatMap((src) => (src ? [absolute(src)] : [])),
    })),
    { url: `${base}/process`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${base}/work`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
      images: work.flatMap((w) => [shareSrc(w.after)].flatMap((src) => (src ? [absolute(src)] : []))),
    },
    { url: `${base}/about`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/play`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
