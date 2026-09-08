# The CMS

Danny edits the site at **`https://<site>/admin/`**, a [Sveltia CMS](https://sveltiacms.app/)
page. It signs him in with GitHub, shows the services, exhibitions and settings as forms,
and every "Save" is a commit to `main`. Cloudflare Workers Builds picks the commit up and
redeploys in a minute or two; the build validates the JSON (`scripts/prepare-content.ts`)
and refuses to ship if an edit is broken.

There is no server component of our own. The pieces:

| Piece | Where | Notes |
| --- | --- | --- |
| Admin page | `public/admin/index.html` | Static. Loads Sveltia from unpkg, pinned to an exact version. |
| CMS config | `public/admin/config.yml` | **Generated** from the Zod schemas by `scripts/generate-cms-config.ts` on every `pnpm content` (so on every `dev`/`build`). Do not edit it by hand. |
| Sign-in Worker | `cms-auth/` | Cloudflare Worker running the upstream [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) script. Holds the GitHub OAuth secret. |
| Content | `content/*.json`, `public/art/` | What the CMS commits. See `content/README.md`. |

The same build step also writes the link-preview images (Open Graph cards) to `public/og/`
from the artwork images and the brand marks in `public/brand/`; the site cannot render
images at request time on Workers, so a new service's card exists as soon as its commit
has built. See `content/README.md`.

`/admin` is excluded from search engines by `src/app/robots.ts` and by a `noindex` meta on
the page itself.

## Developer setup (once)

You need: the Cloudflare account the site deploys to, admin rights on the GitHub repository,
and `pnpm` installed locally (wrangler is a dev dependency of this project).

### 1. Deploy the sign-in Worker

The Worker code is not vendored; clone it into `cms-auth/upstream` (git-ignored):

```sh
git clone https://github.com/sveltia/sveltia-cms-auth.git cms-auth/upstream
git -C cms-auth/upstream checkout 25f56e1ed4a96cb25fcb96469c9c99fb6d3713bc   # known-good pin, Aug 2026
pnpm exec wrangler deploy -c cms-auth/wrangler.jsonc
```

`wrangler deploy` prints the Worker URL, e.g. `https://jenkins-detailing-cms-auth.<your-subdomain>.workers.dev`.
Write it down — it is `<WORKER_URL>` below.

(Upstream also offers a one-click "Deploy to Cloudflare Workers" button at
`https://deploy.workers.cloudflare.com/?url=https://github.com/sveltia/sveltia-cms-auth`.
That works too, but then `ALLOWED_DOMAINS` and the secrets are managed in the dashboard rather
than from `cms-auth/wrangler.jsonc`.)

### 2. Register a GitHub OAuth app

Go to <https://github.com/settings/applications/new> — or, if the repository belongs to an
organisation, *Organisation settings → Developer settings → OAuth Apps → New OAuth App* — and
enter:

| Field | Value |
| --- | --- |
| Application name | `Jenkins Detailing CMS` (anything; Danny sees it on the authorise screen) |
| Homepage URL | the site, e.g. `https://jenkinsdetailing.com` |
| Authorization callback URL | **`<WORKER_URL>/callback`** — exactly, including `/callback` |

Register it, then *Generate a new client secret*. Keep the **Client ID** and the **Client
Secret** for the next step; the secret is shown once.

### 3. Give the Worker its secrets and allowed origins

```sh
pnpm exec wrangler secret put GITHUB_CLIENT_ID     -c cms-auth/wrangler.jsonc   # paste the Client ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET -c cms-auth/wrangler.jsonc   # paste the Client Secret
```

Then edit `ALLOWED_DOMAINS` in `cms-auth/wrangler.jsonc` to the hostname(s) the admin page
is served from, comma-separated. Upstream matches this against the hostname Sveltia sends
(`site_domain`, which defaults to the page's own hostname). A `*` wildcard matches subdomains
only, so list the bare domain as well — e.g. `jenkinsdetailing.com,*.jenkinsdetailing.com`. Remove
`localhost` once you are done testing. Redeploy:

```sh
pnpm exec wrangler deploy -c cms-auth/wrangler.jsonc
```

Without `ALLOWED_DOMAINS` any site could use your Worker to mint tokens — always set it.

### 4. Point the CMS at the repo and the Worker

`public/admin/config.yml` is generated; the two deployment values come from environment
variables read by `scripts/generate-cms-config.ts`:

| Variable | Value | Lands in |
| --- | --- | --- |
| `CMS_REPO` | `owner/name` of this GitHub repository | `backend.repo` |
| `CMS_AUTH_URL` | `<WORKER_URL>` (no trailing slash) | `backend.base_url` |
| `NEXT_PUBLIC_SITE_URL` | already used by the site; adds a "view site" link to the CMS | `site_url` |

Set them in two places:

- **Cloudflare → Workers & Pages → jenkins-detailing → Settings → Build → Variables and secrets** (plain
  variables, not secrets — neither value is confidential), so the build on Cloudflare
  generates the real file.
- Locally, when you want to regenerate and commit the file yourself:

  ```sh
  CMS_REPO=owner/jenkins-detailing CMS_AUTH_URL=https://jenkins-detailing-cms-auth.xyz.workers.dev pnpm cms:config
  ```

Alternatively, edit the `FALLBACK_REPO` / `FALLBACK_AUTH_URL` constants at the top of
`scripts/generate-cms-config.ts` once and forget the env vars. The generator prints a
`WARNING` and writes it into the YAML header while placeholders are in use.

Commit the regenerated `public/admin/config.yml` — it must be in the deployed assets.

### 5. Give Danny access

Sveltia commits as the signed-in GitHub user, so he needs:

1. A GitHub account (free).
2. **Write access to the repository** — *Settings → Collaborators → Add people*, role
   *Write*. He accepts the invitation by email.

The OAuth scope requested is `repo`; on first sign-in GitHub shows an authorise screen for
the "Jenkins Detailing CMS" app.

### 6. Verify end to end

1. Open `https://<site>/admin/`. You should see the Sveltia entrance page (dark) with a
   *Sign in with GitHub* button. If the page is blank, open the browser console: a config
   error names the offending key.
2. Sign in. A popup goes to `<WORKER_URL>/auth`, then GitHub, then back. If it fails with a
   domain message, check `ALLOWED_DOMAINS`; if GitHub complains about the redirect URI,
   check the callback URL in the OAuth app matches `<WORKER_URL>/callback` exactly.
3. Change something trivial in *Site settings* → Save. Within a few seconds a commit
   appears on `main`; a couple of minutes later the site shows the change.

### Custom domain for the Worker (optional)

`*.workers.dev` is fine. If you would rather have `https://auth.jenkinsdetailing.com`:
Cloudflare → Workers & Pages → jenkins-detailing-cms-auth → *Settings → Domains & Routes → Add →
Custom domain*. When the zone is on Cloudflare the DNS record is created for you; otherwise
add the CNAME it shows you. Then update **both** the OAuth app's callback URL and
`CMS_AUTH_URL` (regenerate + commit `config.yml`).

### Local development

- `next dev` serves `public/` files by exact path only, so locally the page is
  **`http://localhost:3000/admin/index.html`**. In production, Workers static assets resolve
  `/admin/` to that file (Cloudflare's default `auto-trailing-slash` handling; Next routing is
  not involved because `run_worker_first` is off in `wrangler.jsonc`), so `/admin/` and
  `/admin` both work.
- Sveltia can also edit the repository on disk without any sign-in: on the entrance page
  choose *Work with Local Repository* and pick the project folder (Chromium browsers only —
  it uses the File System Access API). Edits are written straight to `content/`; run
  `pnpm content` to see them validated.
- To test the auth Worker locally, copy `cms-auth/.dev.vars.example` to `cms-auth/.dev.vars`
  and run `pnpm exec wrangler dev -c cms-auth/wrangler.jsonc`. Use a *separate* OAuth app
  whose callback is `http://localhost:8787/callback`, and generate the config with
  `CMS_AUTH_URL=http://localhost:8787`.

## How the config is generated

`scripts/generate-cms-config.ts` walks `artworkInputSchema`, `exhibitionSchema` and
`settingsSchema` from `src/lib/content/schema.ts`. Types, enum options, defaults,
required-ness, min/max and regex patterns come from Zod; labels, hints, widget choices and
field order come from the presentation maps in the script, which must cover exactly the same
keys — adding a field to the schema without a label, or leaving a stale label behind, fails
`pnpm content`. Enum values without a label fail the same way.

Shape of the result:

- `artworks` and `exhibitions` are *file collections* over `content/services.json` /
  `content/exhibitions.json` with a single `list` field marked **`root: true`**, so Sveltia
  writes a bare JSON array — the same shape the site reads. No wrapper key is needed.
- `street` is the same shape as `artworks` over `content/street.json`, with its own
  `media_folder` (`/public/art/street`). Camera RAW originals never go in `public/`; convert
  them to JPEG first (the originals live in the git-ignored `originals/` folder).
- `settings` is a file collection over `content/settings.json` with the object's fields
  directly.
- `output.omit_empty_optional_fields: true` keeps empty optional fields (no price, no depth,
  no accent colour) out of the JSON, so the pipeline's Zod defaults apply instead of `null`
  or `""` being written.
- Images: the site-wide `media_folder` is `/public/art`; the services collection overrides
  it with `/public/art/gallery` (`public_folder: /art/gallery`), and the street collection
  will use `/public/art/street`. The image widget stores the public path
  (`/art/gallery/perch.jpg`); the schema accepts that as well as the folder-relative name
  and normalises to `gallery/perch.jpg`, so hand-written and CMS-written entries look the
  same to the site.
- The `accentColor` field is a colour picker; Sveltia writes uppercase `#RRGGBB`, the schema
  lower-cases it.

## Upgrading Sveltia

The version is pinned in two places that must match: the `<script src>` in
`public/admin/index.html` and `SVELTIA_VERSION` in `scripts/generate-cms-config.ts` (used for
the `yaml-language-server` schema comment). Bump both, run `pnpm cms:config`, open `/admin/`
and click through an edit. Sveltia moves fast (it was `0.207.1` when this was set up), so
skim its release notes for config changes first.

## Limits worth knowing

- Images live in git and go through GitHub's API: keep single files well under 100 MB.
  A 40–60 MB TIFF is fine but slow to upload; a 20–30 MB JPEG at print resolution is the
  sweet spot. The build makes all web sizes itself.
- Around a hundred pieces the repository gets heavy and builds slow — that is the planned
  trigger for moving content to a database (phase 2). The site reads through one module
  (`src/lib/content`), so nothing in the CMS-facing schema needs to change for that.

---

## For Danny: adding a service

You do this in the browser; nothing to install. Have the image ready — the best photo or scan
you have, straight on, as large as possible (visitors can zoom right in).

1. Go to **your-site/admin/** and press **Sign in with GitHub**. The first time, GitHub asks
   you to allow "Jenkins Detailing CMS" — press *Authorize*. You stay signed in on that browser.
2. In the left column choose **Paintings**. You see the list of every piece, in the order
   they hang.
3. Press **Add Painting** at the bottom of the list (or the *+* next to the heading). A new
   empty card opens. Fill it in top to bottom — every box has a short note under it saying
   what it is for:
   - **Title**, **Year**, **Medium**, **Width / Height** in centimetres.
   - **Web address** — a short lowercase name with hyphens, like `night-bloom`. This becomes
     the page's link, so pick it once and leave it.
   - **Main image** — press *Upload*, choose the file. It appears in the card when done.
   - **Price** is typed in cents (or pence): `250000` means 2,500.00. Leave it empty for
     "Price on request". **Availability** is where you mark a piece *Sold*.
   - **Position** decides where it hangs: lower numbers come first. Use tens (`10`, `20`,
     `30`) so you can slot a piece in later with `15`.
   - The two **3D** menus and the **Accent colour** can stay on *Automatic* — change them
     only when you want to art-direct how that piece is staged.
   - Leave **Show on the site** on. Turn it off to keep a piece as a draft.
4. Press **Save** at the top right. That is it — the site rebuilds itself, and the new piece
   is live in a couple of minutes. Reload the site to see it.

To change something later, open **Paintings**, click the piece, edit, **Save**. To take a
piece down, turn off *Show on the site* and save; it stays in the list so you can bring it
back. You can drag the cards to reorder them instead of typing positions.

If a save ever fails with a red message, nothing has been broken on the live site — the
message tells you which box needs fixing. If in doubt, close the tab and open it again; the
site is never changed until a save goes through.

The generator loads `.env.production` (via `@next/env`), so `NEXT_PUBLIC_SITE_URL` there is what
the CMS uses for its "view site" link; `CMS_REPO` and `CMS_AUTH_URL` still come from the shell or
the Workers Builds variables.
