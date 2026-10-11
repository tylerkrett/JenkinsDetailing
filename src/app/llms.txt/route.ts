import { getPackages, getPages, getServices, getSettings } from "~/lib/content";
import { SITE_DESCRIPTION, absolute } from "~/lib/seo";

/**
 * /llms.txt: the site in plain Markdown for AI assistants and agents, after the llms.txt
 * convention (a title, a one-line summary, then sections of links with notes). Built from
 * the same content as the pages and the JSON-LD, so it never says anything the site does not.
 */
export const dynamic = "force-static";

export async function GET() {
  const [settings, services, packages, pages] = await Promise.all([
    getSettings(),
    getServices(),
    getPackages(),
    getPages(),
  ]);
  const sentences = (...parts: (string | false | undefined)[]) =>
    parts
      .flatMap((p) => (typeof p === "string" && p.trim() ? [p.trim()] : []))
      .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
      .join(" ");
  const socials = Object.entries(settings.socials).filter(([, url]) => typeof url === "string" && url.length > 0);

  const md = [
    `# ${settings.name}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    sentences(pages.about.description, pages.about.story.split(/\n\s*\n/)[0]),
    "",
    "## Contact",
    "",
    `- Address: ${settings.addressLine}, ${settings.town} ${settings.postcode}, Wales, UK`,
    `- Phone: ${settings.phone} (+${settings.phoneDigits})`,
    `- Email: ${settings.email}`,
    `- Opening hours: ${settings.hoursText.split("\n").join("; ")}`,
    `- [Get a quote](${absolute("/contact")}): ${settings.replyPromise}`,
    ...(settings.directionsUrl ? [`- [Directions](${settings.directionsUrl})`] : []),
    ...socials.map(([name, url]) => `- [${name[0]?.toUpperCase()}${name.slice(1)}](${url})`),
    "",
    "## Services",
    "",
    ...services.map((s) => {
      const tiers = packages.filter((p) => p.service === s.slug);
      return `- [${s.title}](${absolute(`/services/${s.slug}`)}): ${sentences(
        s.promise,
        s.fromPriceGBP !== undefined && `From £${s.fromPriceGBP}`,
        s.priceNote,
        tiers.length > 0 &&
          `Packages: ${tiers.map((p) => (p.summary ? `${p.name} (${p.summary.replace(/\.$/, "")})` : p.name)).join("; ")}`,
        s.duration && `Typical time: ${s.duration}`,
        s.guarantee && `Guarantee: ${s.guarantee}`,
        s.mobile ? "At the unit in Tregaron or at your door" : "At the unit in Tregaron",
      )}`;
    }),
    "",
    "## Questions",
    ...services.flatMap((s) =>
      s.faq.length ? ["", `### ${s.title}`, "", ...s.faq.map((q) => `- ${q.question} ${q.answer}`)] : [],
    ),
    "",
    "## Pages",
    "",
    `- [How it works](${absolute("/watch?view=plain")}): the process step by step, from arrival to handover`,
    `- [Work](${absolute("/work")}): photos of recent jobs`,
    `- [About](${absolute("/about")}): who runs ${settings.name} and how it started`,
    `- [Contact](${absolute("/contact")}): the quote form, phone, WhatsApp and email`,
    "",
    "## Optional",
    "",
    `- [Bucket Run](${absolute("/play")}): ${pages.play.description}`,
    `- [Privacy](${absolute("/privacy")})`,
    `- [Terms](${absolute("/terms")})`,
    "",
  ].join("\n");

  return new Response(md, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
