# Deploying Jenkins Detailing to Cloudflare

The site runs on Cloudflare Workers through OpenNext (`@opennextjs/cloudflare`). Two ways
to deploy; use A for the first release, then B for every day after.

## A. First deploy from this machine

1. Sign in once: `pnpm exec wrangler login` (opens the browser).
2. Build and check under the real runtime: `pnpm preview`, open http://localhost:8787,
   scroll the bay, open a service, send a test quote request. Ctrl+C when done.
3. Deploy: `pnpm deploy`. Wrangler prints the `*.workers.dev` URL.
4. `NEXT_PUBLIC_SITE_URL` is baked in at build time (sitemap, robots, canonical links, OG).
   It lives in `.env.production` (committed, no secrets). Change it to `https://jenkinsdetailing.com`
   once the domain is attached, then deploy again. A dashboard variable cannot set it.
   In the Cloudflare dashboard, Workers & Pages → jenkins-detailing → Settings → Variables, add:
   - `RESEND_API_KEY` (secret), `ENQUIRY_FROM`, `ENQUIRY_TO`, `TURNSTILE_SECRET_KEY` (secret) and the build variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (an address on a domain verified in Resend)
     so quote requests are emailed to info@jenkinsdetailing.com. Without the Resend values requests only log; without the Turnstile values the anti-spam check is skipped.
   `keep_vars: true` in wrangler.jsonc keeps these across deploys.
5. Redeploy after adding variables: `pnpm deploy`.
6. Custom domain: Settings → Domains & Routes → add `jenkinsdetailing.com` (the zone must be on Cloudflare).

## B. Git-connected builds (Danny's CMS depends on this)

1. Push the repo to GitHub.
2. Dashboard → Workers & Pages → Create → Import a repository → pick it.
   - Build command: `pnpm run build:cf`  (see package.json; runs the content pipeline, then OpenNext)
   - Deploy command: `pnpm exec opennextjs-cloudflare deploy`
   - Root directory: `/`
3. Build variables: `CMS_REPO` (e.g. `owner/jenkins-detailing`) and `CMS_AUTH_URL` (the auth Worker URL
   from docs/cms.md). `NEXT_PUBLIC_SITE_URL` comes from `.env.production`; the runtime
   variables from step A4 are set once in the dashboard.
4. Every push to `main` now builds and deploys; branches get preview URLs.

## C. The CMS (so Danny can publish himself)

Follow docs/cms.md: deploy the small auth Worker, create the GitHub OAuth app, set
`CMS_REPO` and `CMS_AUTH_URL`, give Danny a GitHub account with write access.
The admin lives at `/admin/`.

## Before announcing

- Real prices, hours, company number and reviews in the CMS.
- Test on a real iPhone: swipe, snap, tap the car, the tilt prompt.
- Lighthouse on a service page and the contact page.

## GitHub Actions (deploy on push to main)

`.github/workflows/deploy.yml` builds and deploys every push to `main` and shows up in the
repository's Actions tab. One-time setup in GitHub → Settings → Secrets and variables → Actions:

- Secret `CLOUDFLARE_API_TOKEN`: create at dash.cloudflare.com → My Profile → API Tokens →
  "Edit Cloudflare Workers" template (scope it to this account).
- Secret `CLOUDFLARE_ACCOUNT_ID`: shown on the Workers & Pages overview page.
- Variable `CMS_AUTH_URL`: the sign-in Worker URL from docs/cms.md (can be added later).

The workflow runs the content pipeline, typecheck, lint, the OpenNext build, then
`wrangler deploy`. Runtime secrets (RESEND_API_KEY, ENQUIRY_FROM, ENQUIRY_TO, TURNSTILE_SECRET_KEY) stay in the Cloudflare
dashboard and survive deploys because wrangler.jsonc sets `keep_vars`.

If you use this, do not also connect the repo to Cloudflare Workers Builds, or every push
deploys twice.
