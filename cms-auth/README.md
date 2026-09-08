# cms-auth — GitHub sign-in for the CMS

The admin page at `/admin/` (Sveltia CMS) signs the artist in with GitHub. GitHub's
OAuth flow needs a tiny server-side step that must hold the app's client secret, so it
runs as a separate Cloudflare Worker: the upstream
[sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) script, unmodified.

This directory holds only our deployment configuration. The Worker code itself is **not
vendored**: clone it into `./upstream` (git-ignored) and deploy from there, so upgrades
are a `git pull` and there is nothing to keep in sync by hand.

```
cms-auth/
  wrangler.jsonc      our Worker name, ALLOWED_DOMAINS, compatibility date
  .dev.vars.example   template for local secrets (copy to .dev.vars)
  upstream/           clone of sveltia/sveltia-cms-auth — git-ignored, created by you
```

The full walkthrough (GitHub OAuth app, secrets, config.yml) is in
[`docs/cms.md`](../docs/cms.md). Short version:

```sh
# from the repository root
git clone https://github.com/sveltia/sveltia-cms-auth.git cms-auth/upstream
git -C cms-auth/upstream checkout 25f56e1ed4a96cb25fcb96469c9c99fb6d3713bc   # known-good pin

pnpm exec wrangler deploy -c cms-auth/wrangler.jsonc                      # prints the Worker URL
pnpm exec wrangler secret put GITHUB_CLIENT_ID     -c cms-auth/wrangler.jsonc
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET -c cms-auth/wrangler.jsonc
```

Then put the Worker URL in `CMS_AUTH_URL` (it becomes `backend.base_url` in the generated
`public/admin/config.yml`) and set `ALLOWED_DOMAINS` in `wrangler.jsonc` to the site's real
hostname(s).

Upstream has no dependencies and no build step — `main` in `wrangler.jsonc` points straight
at `upstream/src/index.js`. It has no release tags either, which is why the pin above is a
commit SHA; to upgrade, `git -C cms-auth/upstream pull`, read the diff, redeploy.
