import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { getService, getSettings } from "~/lib/content";
import { quoteInputSchema } from "~/lib/content/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * What the form sends. `website` is a honeypot: humans never see the field, so anything
 * in it means a bot filled the form. We answer "sent" and drop the message.
 * `turnstileToken` is Cloudflare Turnstile's proof of a real browser; it is checked
 * whenever the secret key is configured.
 */
export const quoteSubmitSchema = quoteInputSchema.extend({
  website: z.string().optional(),
  turnstileToken: z.string().optional(),
});
export type QuoteSubmitInput = z.infer<typeof quoteSubmitSchema>;

const SEND_FAILED = "The request could not be sent. Try again in a moment, or call or WhatsApp us.";
const DEFAULT_FROM = "Jenkins Detailing <onboarding@resend.dev>";

const SIZE_LABEL = { small: "Small car", medium: "Medium car", large: "Large car or SUV", van: "Van" } as const;
const WHERE_LABEL = { unit: "At the unit in Tregaron", mobile: "At my address" } as const;

/**
 * Cheap per-isolate rate limit: 5 sends per 10 minutes per IP. Workers isolates are
 * short-lived and not shared across the edge, so this blunts a naive loop rather than
 * a distributed one; Turnstile is the real gate.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function allow(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

/** Verify a Turnstile token with Cloudflare. True when no secret is configured (local dev). */
async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip === "local" ? undefined : ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("[quote] Turnstile verify failed:", error);
    return false;
  }
}

export const quoteRouter = createTRPCRouter({
  /** The public contact details to fall back to when sending fails. */
  contact: publicProcedure.query(async () => {
    const s = await getSettings();
    return { email: s.email, phone: s.phone, phoneDigits: s.phoneDigits };
  }),

  submit: publicProcedure.input(quoteSubmitSchema).mutation(async ({ input, ctx }) => {
    if (input.website) return { ok: true as const };

    const ip = ctx.headers.get("cf-connecting-ip") ?? ctx.headers.get("x-forwarded-for") ?? "local";
    if (!allow(ip)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests in a short time. Wait a few minutes, or call us.",
      });
    }
    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The anti-spam check did not pass. Reload the page and try again, or call us.",
      });
    }

    try {
      const [settings, service] = await Promise.all([getSettings(), input.service ? getService(input.service) : null]);

      const subject = service ? `Quote request: ${service.title}` : "Quote request";
      const text = [
        `Name: ${input.name}`,
        `Email: ${input.email}`,
        input.phone ? `Phone: ${input.phone}` : null,
        service ? `Service: ${service.title}` : null,
        `Vehicle: ${input.vehicle}`,
        `Size: ${SIZE_LABEL[input.size]}`,
        `Where: ${WHERE_LABEL[input.where]}${input.postcode ? ` (${input.postcode})` : ""}`,
        "",
        input.message,
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      const payload = {
        from: env.ENQUIRY_FROM ?? DEFAULT_FROM,
        to: [env.ENQUIRY_TO ?? settings.email],
        reply_to: input.email,
        subject,
        text,
      };

      if (!env.RESEND_API_KEY) {
        console.log("[quote] RESEND_API_KEY not set; would send:", payload);
        return { ok: true as const };
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[quote] Resend responded ${res.status}: ${detail}`);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: SEND_FAILED });
      }

      return { ok: true as const };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("[quote] send failed:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: SEND_FAILED, cause: error });
    }
  }),
});
