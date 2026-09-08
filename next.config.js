/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import("next").NextConfig} */
const config = {
  // `next dev` and `next build` share this folder by default; a running dev server then
  // corrupts a production build. The dev script points this at .next-dev instead.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Artwork sizes are generated at build time by scripts/prepare-content.ts and served as
  // static assets, so Next's runtime optimiser (unavailable on Workers) is not needed.
  images: { unoptimized: true },
};

export default config;

// Exposes Cloudflare bindings to `next dev` so local and deployed behaviour match.
initOpenNextCloudflareForDev();
