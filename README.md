# Jenkins Detailing

A site for Jenkins Detailing, a CarPro approved detailing centre in Tregaron, Mid Wales.
The home page and every inner page are plain, fast and photo led, with no WebGL. The
scroll-driven 3D bay lives on `/watch`: scrolling cleans a supercar act by act (arrive,
wash, under the car, inside, paint correction, ceramic protection, reveal), and every act
stops to say what is being done and why. A 3D | Plain switch there swaps it for the same
steps as a plain page and remembers the choice for a year in the `jd-view` cookie
(`?view=plain` in a link sets it too); reduced motion, a data saver or no WebGL2 always get
the plain page. The site sells nothing; it asks for the job.

Plan, research and design rationale: `/Users/krett/.claude/plans/jenkins-detailing.md`.
The codebase is a fork of the HIMBAD site (`../Himbad`); the scene plumbing, content
pipeline, CMS, game engine and deployment are shared by design.

## Stack

- Next.js 15 (App Router), TypeScript strict, Tailwind v4, tRPC 11
- three / @react-three/fiber / drei / postprocessing, zustand, lenis
- Content as JSON in `content/`, edited through Sveltia CMS at `/admin` (see `docs/cms.md`)
- Cloudflare Workers via `@opennextjs/cloudflare`
- Photos processed at build time by `sharp` into `public/photos-derived/`

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the content pipeline, then Next dev |
| `pnpm content` | Validates `content/*.json`, generates photo sizes, the `*.generated.json` files, the CMS config, the share cards and the offline game shell |
| `pnpm typecheck` / `pnpm lint` | Type and lint checks (run the content pipeline first) |
| `pnpm build` | Production Next build |
| `pnpm preview` | OpenNext build and a local `workerd` server, the real runtime |
| `pnpm deploy` | OpenNext build and deploy to Cloudflare Workers |
| `pnpm icons` | Regenerates every favicon and PWA icon from `public/brand/mark.png` |

Direct binaries (`./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/next lint`)
avoid pnpm's pre-run dependency check when iterating.

## Content

Everything the site shows lives in `content/` and `public/photos/`. See `content/README.md`
for the fields and `docs/cms.md` for the CMS setup. Nothing in `src/` reads a data source
directly: all reads go through `src/lib/content/index.ts`.

## Scene

`src/lib/scene/bay-layout.ts` is the world: the seven acts as camera poses, the scroll
spans and the dwell windows. `src/components/scene/bay/` holds the meshes. Everything is a
pure function of scroll progress. The camera rig, scroll driver, captions and index in
`src/components/scene/` only ever talk to the `WorldLayout` interface in
`src/lib/scene/world.ts`. The canvas mounts only in the 3D view of `/watch`
(`src/components/watch/`), so no other page downloads three.js, the car or the textures.
`/process` redirects to `/watch?view=plain`.

Keeping the bay fast (about 300 draw calls a frame, and nothing compiles once it has
revealed): static scenery goes inside `<Batched>`, which merges it by material; a light is
never hidden or added after mount, only dimmed, or every material in the scene recompiles;
anything that appears later in the scroll is mounted from the start, hidden, so `Warmup`
compiles it behind the preloader; and no refracting (transmission) materials, which make
the renderer draw the whole scene twice. In development `window.__jd.stats()` reports draw
calls, triangles and compiled programs per frame.

## Verification tooling

Headless Chrome via `playwright-core` and the locally installed Chrome:

- `node scripts/shot.mjs <url> <out.png> [w] [h] [fullPage]` screenshots a page and prints console errors.
- `node scripts/perf-check.mjs <url> [passes]` scrolls the acts repeatedly and samples draw calls and heap.
- In development `window.__jdGo(i)` jumps to act `i` and `window.__jd.scene()` reports the scene state.
- `node scripts/act-stills.mjs [url]` shoots one 2x still per act into `public/photos/acts/` (dev server only). Run `pnpm content` afterwards.
- `node scripts/redesign-check.mjs [base]` screenshots every page at 390, 768 and 1440 px into `.playwright-mcp/redesign/`, runs axe, and checks the 3D | Plain switch (cookie, reload, new tab, `?view=`, `?act=`, reduced motion, no WebGL, Save-Data), the redirect, the keyboard paths and the quote form controls. `--no-3d` skips the WebGL part; `--only-3d` runs only that.

## Environment

Copy `.env.example` to `.env`. `NEXT_PUBLIC_SITE_URL` sets canonical URLs and the sitemap;
`RESEND_API_KEY`, `ENQUIRY_FROM` and `ENQUIRY_TO` send quote requests (without a key they
log to the console); the two Turnstile keys switch the anti-spam check on.

## Deploying

See `docs/deploy.md`. In short: `pnpm preview` to check under `workerd`, `pnpm deploy` for
the first release, then GitHub Actions on every push to `main`.
