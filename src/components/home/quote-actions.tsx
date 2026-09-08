import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

import { QuoteButton } from "~/components/quote/quote-button";
import { secondaryButtonClass } from "~/components/quote/styles";
import { cn } from "~/lib/cn";
import type { Service, SiteSettings } from "~/lib/content";
import { whatsappHref } from "~/lib/format";

type Props = {
  services: Pick<Service, "slug" | "title">[];
  settings: Pick<SiteSettings, "phoneDigits">;
  service?: Pick<Service, "slug" | "title">;
  className?: string;
};

/** The two ways to ask: the quote drawer and WhatsApp. Everywhere the site asks for the job. */
export function QuoteActions({ services, settings, service, className }: Props) {
  const line = service ? `Hi Danny, I would like a quote for ${service.title.toLowerCase()}.` : "Hi Danny, I would like a quote.";
  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <QuoteButton services={services} service={service} />
      <a
        href={whatsappHref(settings.phoneDigits, line)}
        target="_blank"
        rel="noreferrer"
        className={cn(secondaryButtonClass, "gap-2")}
      >
        <WhatsappLogo size={20} aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );
}
