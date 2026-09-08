"use client";

import { List, WhatsappLogo, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { telHref, whatsappHref } from "~/lib/format";

import { NAV_LINKS } from "./nav-links";

/** Full-screen menu for narrow viewports. Closes on navigation and Escape. */
type Props = { className?: string; phone: string; phoneDigits: string; email: string };

export function MobileMenu({ className, phone, phoneDigits, email }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const trigger = openRef.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className={className}>
      <button
        ref={openRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="text-bone hover:text-accent -mr-2 flex h-11 w-11 items-center justify-center transition-colors"
      >
        <List size={26} aria-hidden="true" />
      </button>

      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        className={cn(
          "bg-ink fixed inset-0 z-50 flex flex-col [overscroll-behavior:contain] px-6 pt-4 pb-10",
          "motion-safe:transition-opacity motion-safe:duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex h-12 items-center justify-end">
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="text-bone hover:text-accent -mr-2 flex h-11 w-11 items-center justify-center transition-colors"
          >
            <X size={26} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Primary" className="mt-10 flex-1">
          <ul className="flex flex-col gap-5">
            <li>
              <Link
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                className="font-display text-display-md hover:text-accent aria-[current=page]:text-accent block font-bold transition-colors"
              >
                Home
              </Link>
            </li>
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? "page" : undefined}
                  className="font-display text-display-md hover:text-accent aria-[current=page]:text-accent block font-bold transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="text-bone/70 flex flex-col gap-4 pb-[env(safe-area-inset-bottom)] text-base">
          <a href={telHref(phoneDigits)} className="hover:text-accent tabular-nums transition-colors">
            {phone}
          </a>
          <a
            href={whatsappHref(phoneDigits)}
            target="_blank"
            rel="noreferrer"
            className="hover:text-accent inline-flex items-center gap-2 transition-colors"
          >
            <WhatsappLogo size={22} aria-hidden="true" />
            WhatsApp
          </a>
          <a href={`mailto:${email}`} className="hover:text-accent transition-colors">
            {email}
          </a>
        </div>
      </div>
    </div>
  );
}
