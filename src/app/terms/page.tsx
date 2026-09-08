import type { Metadata } from "next";

import { LegalPage } from "~/components/site/legal-page";
import { getPages, getSettings } from "~/lib/content";
import { OG, ogImage, pageMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { terms } = await getPages();
  return pageMetadata({
    title: terms.title,
    description: terms.description,
    path: "/terms",
    images: [ogImage(OG.site, "Jenkins Detailing")],
  });
}

export default async function TermsPage() {
  const [settings, { terms }] = await Promise.all([getSettings(), getPages()]);
  return <LegalPage path="/terms" title={terms.title} description={terms.description} body={terms.body} settings={settings} />;
}
