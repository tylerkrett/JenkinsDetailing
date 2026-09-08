import { Phone } from "@phosphor-icons/react/dist/ssr";

import { getSettings } from "~/lib/content";
import { telHref } from "~/lib/format";

import { MobileMenu } from "./mobile-menu";
import { NAV_LINKS } from "./nav-links";
import { NavLink } from "./nav-link";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const s = await getSettings();
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16">
      <div className="from-ink/90 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent" />
      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <Wordmark />
        <div className="flex items-center gap-6">
          <nav aria-label="Primary" className="hidden sm:block">
            <ul className="flex items-center gap-7">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <NavLink
                    href={l.href}
                    className="text-bone/80 hover:text-bone decoration-accent/0 hover:decoration-accent aria-[current=page]:text-bone underline-offset-[6px] transition-colors duration-200 hover:underline"
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {/* This audience calls. The number is one tap away at every size. */}
          <a
            href={telHref(s.phoneDigits)}
            aria-label={`Call ${s.phone}`}
            className="text-bone hover:text-accent flex h-11 w-11 items-center justify-center transition-colors sm:w-auto sm:gap-2 sm:px-2"
          >
            <Phone size={22} aria-hidden="true" />
            <span className="hidden text-sm font-medium tabular-nums md:inline">{s.phone}</span>
          </a>
          <MobileMenu className="sm:hidden" phone={s.phone} phoneDigits={s.phoneDigits} email={s.email} />
        </div>
      </div>
    </header>
  );
}
