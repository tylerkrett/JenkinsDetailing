import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

/** The small tracked label above a section title. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  /** The full page for this section, linked opposite the title. */
  href?: string;
  link?: string;
};

/** Eyebrow, section title and an optional link onwards: the head of every home section. */
export function SectionHeader({ id, eyebrow, title, href, link }: Props) {
  return (
    <div data-reveal className="section-heading">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="font-display text-display-lg mt-4 font-bold tracking-tight">
          {title}
        </h2>
      </div>
      {href && link ? (
        <Link href={href} className="text-link">
          {link}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
