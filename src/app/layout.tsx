import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Archivo, Figtree } from "next/font/google";

import { SceneLoader } from "~/components/scene/scene-loader";
import { SiteFooter } from "~/components/site/footer";
import { SiteHeader } from "~/components/site/header";
import { JsonLd } from "~/components/site/json-ld";
import { OfflineNotice } from "~/components/site/offline-notice";
import { ServiceWorkerRegister } from "~/components/site/sw-register";
import { getReviews, getSettings } from "~/lib/content";
import { OG, SITE_DESCRIPTION, SITE_NAME, SITE_URL, businessJsonLd, graph, ogImage, websiteJsonLd } from "~/lib/seo";
import { TRPCReactProvider } from "~/trpc/react";

const siteImage = ogImage(OG.site, "Jenkins Detailing, Tregaron");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  keywords: [
    "car detailing",
    "paint correction",
    "ceramic coating",
    "undersealing",
    "Tregaron",
    "Ceredigion",
    "Mid Wales",
    "CarPro approved",
  ],
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_GB",
    url: "/",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [siteImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: siteImage.url, alt: siteImage.alt, width: 1200, height: 630 }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  formatDetection: { email: false, address: false, telephone: false },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#06080f",
  colorScheme: "dark",
};

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const archivo = Archivo({
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  variable: "--font-archivo",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, reviews] = await Promise.all([getSettings(), getReviews()]);
  return (
    <html lang="en-GB" className={`${figtree.variable} ${archivo.variable}`}>
      <body className="bg-ink text-bone font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <JsonLd data={graph(websiteJsonLd(), businessJsonLd(settings, reviews))} />
        <TRPCReactProvider>
          <SceneLoader />
          <div className="relative z-10">
            <SiteHeader />
            {children}
            <SiteFooter />
            <OfflineNotice />
          </div>
          <ServiceWorkerRegister />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
