import type { Metadata } from "next";

import { LegalPage } from "~/components/site/legal-page";
import { getPages, getSettings } from "~/lib/content";
import { OG, ogImage, pageMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { privacy } = await getPages();
  return pageMetadata({
    title: privacy.title,
    description: privacy.description,
    path: "/privacy",
    images: [ogImage(OG.site, "Jenkins Detailing")],
  });
}

export default async function PrivacyPage() {
  const [settings, { privacy }] = await Promise.all([getSettings(), getPages()]);
  return (
    <LegalPage path="/privacy" title={privacy.title} description={privacy.description} body={privacy.body} settings={settings} />
  );
}
