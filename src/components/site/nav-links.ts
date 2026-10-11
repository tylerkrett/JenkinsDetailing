type NavItem = {
  href: string;
  label: string;
  /** Added to the link's accessible name, for a label that does not say where it goes on its own. */
  hint?: string;
};

export const NAV_LINKS: readonly NavItem[] = [
  { href: "/services", label: "Services" },
  { href: "/watch", label: "Watch it" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Get a quote" },
  // After the quote, as on the home page: something to do while the reply comes.
  { href: "/play", label: "While you wait", hint: "play Bucket Run" },
];
