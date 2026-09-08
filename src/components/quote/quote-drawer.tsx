"use client";

import { X } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "~/lib/cn";
import type { Service } from "~/lib/content";

import { QuoteForm } from "./quote-form";

type Props = {
  open: boolean;
  onClose: () => void;
  services: Pick<Service, "slug" | "title">[];
  service?: Pick<Service, "slug" | "title">;
  /** Where focus goes when the drawer closes. Falls back to whatever was focused on open. */
  triggerRef?: RefObject<HTMLElement | null>;
};

const SLIDE_MS = 300;
const AUTO_CLOSE_MS = 4000;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Right-hand quote panel. Slides in over the current page (transform), the backdrop
 * fades (opacity), and nothing else moves. Escape, the backdrop and the close button all
 * close it. Focus lands on the first field on open and returns to the trigger on close.
 */
export function QuoteDrawer({ open, onClose, services, service, triggerRef }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const autoCloseTimer = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  const clearAutoClose = useCallback(() => {
    if (autoCloseTimer.current !== null) {
      window.clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    clearAutoClose();
    const timer = window.setTimeout(() => setMounted(false), SLIDE_MS + 20);
    return () => window.clearTimeout(timer);
  }, [open, clearAutoClose]);

  useEffect(() => {
    if (!mounted || !open) return;
    const frame = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('select, input:not([tabindex="-1"])');
      first?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [mounted, open]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const target = triggerRef?.current ?? previouslyFocused.current;
    if (target && document.contains(target)) target.focus();
  }, [open, triggerRef]);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => clearAutoClose, [clearAutoClose]);

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onSent() {
    clearAutoClose();
    autoCloseTimer.current = window.setTimeout(() => {
      autoCloseTimer.current = null;
      const inside = panelRef.current?.contains(document.activeElement) ?? false;
      if (!inside) onClose();
    }, AUTO_CLOSE_MS);
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "bg-ink/70 ease-out-quint absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
          shown ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
        className={cn(
          "hairline bg-ink-2 absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto overscroll-contain border-l px-6 pt-8 pb-10 sm:px-8",
          "ease-out-quint transition-transform duration-300 will-change-transform motion-reduce:transition-none",
          shown ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-display-md font-bold tracking-tight">
              Get a quote
            </h2>
            {service ? <p className="text-bone/70 mt-2">For {service.title.toLowerCase()}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-bone/70 hover:text-bone -mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center transition-colors duration-200"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <QuoteForm key={service?.slug ?? "general"} services={services} service={service?.slug} onSuccess={onSent} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
