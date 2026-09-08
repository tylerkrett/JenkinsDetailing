"use client";

import { useEffect, useRef } from "react";

import { env } from "~/env";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

type Props = { onToken: (token: string | null) => void };

/**
 * Cloudflare Turnstile, rendered only when a site key is configured. The script is
 * fetched on first mount, so pages without the form never load it. Reports the token
 * to the form, and null when it expires or errors so the form can ask for a retry.
 */
export function Turnstile({ onToken }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const key = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!key || !box.current) return;
    let id: string | null = null;
    let cancelled = false;
    const el = box.current;
    void loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        id = api.render(el, {
          sitekey: key,
          theme: "dark",
          size: "flexible",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [key, onToken]);

  if (!key) return null;
  return <div ref={box} className="min-h-16" />;
}

export const turnstileEnabled = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
