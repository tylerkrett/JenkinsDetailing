const pounds = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/** "£250" from whole pounds. */
export function formatPounds(value: number) {
  return pounds.format(value);
}

/** "from £150" or nothing. */
export function fromPrice(value: number | undefined) {
  return value === undefined ? null : `from ${formatPounds(value)}`;
}

/** Split authored text into paragraphs on blank lines, dropping empties. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Lines of a plain-text block, trimmed, empties dropped. */
export function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "+44 7805 538 687" style tel: href from international digits. */
export function telHref(digits: string) {
  return `tel:+${digits}`;
}

/** WhatsApp click-to-chat with an optional prefilled line. */
export function whatsappHref(digits: string, text?: string) {
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}
