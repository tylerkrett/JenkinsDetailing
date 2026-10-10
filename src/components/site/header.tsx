import { Phone, Play } from "@phosphor-icons/react/dist/ssr";

import { getSettings } from "~/lib/content";
import { telHref } from "~/lib/format";

import { HeaderSurface } from "./header-surface";
import { MobileMenu } from "./mobile-menu";
import { NAV_LINKS } from "./nav-links";
import { NavLink } from "./nav-link";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const s = await getSettings();
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-20">
      <HeaderSurface />
      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <Wordmark markClassName="h-16" />
        <div className="flex items-center gap-6">
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <NavLink
                    href={l.href}
                    className="text-bone/80 hover:text-bone decoration-accent/0 hover:decoration-accent aria-[current=page]:text-bone inline-flex items-center gap-1.5 underline-offset-[6px] transition-colors duration-200 hover:underline"
                  >
                    {l.href === "/watch" ? (
                      <Play size={12} weight="fill" aria-hidden="true" className="text-accent-lit" />
                    ) : null}
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
          <MobileMenu className="lg:hidden" phone={s.phone} phoneDigits={s.phoneDigits} email={s.email} />
        </div>
      </div>
    </header>
  );
}
