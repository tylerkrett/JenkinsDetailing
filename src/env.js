import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    /** Resend API key. When unset, quote requests are logged to the server console instead of sent. */
    RESEND_API_KEY: z.string().min(1).optional(),
    /** Sender for quote emails, e.g. `Jenkins Detailing <quotes@jenkinsdetailing.com>`. Must be a verified Resend domain. */
    ENQUIRY_FROM: z.string().min(1).optional(),
    /** Where quote requests go. Defaults to the email in content/settings.json. */
    ENQUIRY_TO: z.string().email().optional(),
    /** Cloudflare Turnstile secret. When unset, the anti-spam check is skipped (local dev). */
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  },

  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    /** Cloudflare Turnstile site key. When unset, the widget is not rendered. */
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ENQUIRY_FROM: process.env.ENQUIRY_FROM,
    ENQUIRY_TO: process.env.ENQUIRY_TO,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
