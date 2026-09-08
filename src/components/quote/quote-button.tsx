"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import type { Service } from "~/lib/content";

import { QuoteDrawer } from "./quote-drawer";
import { primaryButtonClass } from "./styles";

type Props = {
  services: Pick<Service, "slug" | "title">[];
  service?: Pick<Service, "slug" | "title">;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Opens the quote drawer over the current page. Without a className it renders as the
 * primary button; pass one to restyle it in place.
 */
export function QuoteButton({ services, service, className, children }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(className ?? primaryButtonClass)}
      >
        {children ?? "Get a quote"}
      </button>
      <QuoteDrawer open={open} onClose={close} services={services} service={service} triggerRef={triggerRef} />
    </>
  );
}
