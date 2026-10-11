import { FacebookLogo, InstagramLogo, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { getServices, getSettings } from "~/lib/content";
import { lines, telHref, whatsappHref } from "~/lib/format";

import { NAV_LINKS } from "./nav-links";
import { Wordmark } from "./wordmark";

export async function SiteFooter() {
  const [s, services] = await Promise.all([getSettings(), getServices()]);
  const socials = [
    { href: s.socials.instagram, label: "Instagram", Icon: InstagramLogo },
    { href: s.socials.facebook, label: "Facebook", Icon: FacebookLogo },
  ].filter((x): x is typeof x & { href: string } => Boolean(x.href));
  const legal = [
    s.legalName,
    s.companyNumber ? `Company number ${s.companyNumber}` : "",
    s.registeredOffice ? `Registered office: ${s.registeredOffice}` : "",
    s.vatNumber ? `VAT ${s.vatNumber}` : "",
  ].filter(Boolean);

  return (
    <footer className="bg-ink-2 hairline relative z-10 border-t">
      <div className="site-container grid gap-10 pt-16 pb-10 sm:grid-cols-2 lg:grid-cols-12">
        <div className="flex flex-col items-start gap-5 lg:col-span-4">
          <Wordmark />
          {s.carproApproved ? <p className="text-bone/60 text-sm">CarPro approved detailing centre</p> : null}
          <address className="text-bone/70 text-sm not-italic">
            {s.addressLine}
            <br />
            {s.town} {s.postcode}
          </address>
          <div className="text-bone/70 flex flex-col gap-1.5 text-sm">
            <a href={telHref(s.phoneDigits)} className="hover:text-bone tabular-nums transition-colors">
              {s.phone}
            </a>
            <a
              href={whatsappHref(s.phoneDigits, "Hi Danny, I would like a quote for")}
              target="_blank"
              rel="noreferrer"
              className="hover:text-bone inline-flex items-center gap-2 transition-colors"
            >
              <WhatsappLogo size={18} aria-hidden="true" />
              WhatsApp
            </a>
            <a href={`mailto:${s.email}`} className="hover:text-bone transition-colors">
              {s.email}
            </a>
          </div>
        </div>
        <div className="lg:col-span-3">
          <h2 className="footer-heading">Services</h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            {services.map((svc) => (
              <li key={svc.slug}>
                <Link href={`/services/${svc.slug}`} className="text-bone/80 hover:text-bone transition-colors">
                  {svc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2">
          <h2 className="footer-heading">Pages</h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-label={l.hint ? `${l.label}, ${l.hint}` : undefined}
                  className="text-bone/80 hover:text-bone transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-3">
          <h2 className="footer-heading">Hours</h2>
          <p className="text-bone/80 mt-4 text-sm">
            {lines(s.hoursText).map((l, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {l}
              </span>
            ))}
          </p>
          {socials.length > 0 ? (
            <div className="mt-6 flex items-center gap-5">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={`${label} (opens in a new tab)`}
                  target="_blank"
                  rel="me noreferrer"
                  className="text-bone/70 hover:text-accent transition-colors"
                >
                  <Icon size={22} aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="site-container">
        <div className="hairline text-bone/60 flex flex-col gap-3 border-t py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            {legal.join(". ")}
            {legal.length ? ". " : ""}
            3D car model by the Khronos Group,{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="hover:text-bone underline underline-offset-2">
              CC BY 4.0
            </a>
            .
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-bone transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-bone transition-colors">
              Terms
            </Link>
            <p>
              © {new Date().getFullYear()} {s.name}
            </p>
            <a
              href="https://krett.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-bone transition-colors"
            >
              Designed & developed by Krett.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
