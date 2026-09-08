# Content

Everything the site shows lives here as JSON, edited by hand or through the CMS at
`/admin/` (Sveltia CMS; setup in [`docs/cms.md`](../docs/cms.md)). `scripts/prepare-content.ts`
validates it on every build and generates the `*.generated.json` files (git-ignored) plus
the photo sizes under `public/photos-derived/`. The CMS form definitions in
`public/admin/config.yml` are generated from the same Zod schemas
(`src/lib/content/schema.ts`) by `scripts/generate-cms-config.ts`, so the two cannot drift.

Photos are paths inside `public/photos/`, one folder deep: `about/danny-foam.jpg`,
`process/underside-foam.jpg`, `services/...`, `work/...`. The CMS writes them as
`/photos/<folder>/<file>` and the schema accepts both forms.

- `settings.json`: the business. Name, legal name and company details for the footer,
  the promise line, address, phone (as shown, and digits only for WhatsApp and tap to
  call), email, hours (as shown, and in `Mo-Fr 09:00-17:00` form for search engines),
  directions link, established year, CarPro approval, Google rating and count once
  confirmed, the portrait and unit photos, socials.
- `services.json`: one entry per service, a bare array. `promise` is the one line under
  the title; `includes` is a list of what is in the job; `fromPriceGBP` is whole pounds
  and can be left out when a price needs an inspection; `mobile` means available at the
  customer's door; `featured` puts it on the home page; `published` off keeps a draft.
- `packages.json`: the paint correction tiers, each pointing at a service by slug.
- `process.json`: the seven acts of the scene in order. `what` and `why` are the two
  lines shown at each stop; `text` is the longer version for the process page; `service`
  links the stop to a service page; `act` is 1 to 7.
- `work.json`: before and after pairs with a title, the service, the vehicle and a caption.
- `reviews.json`: reviews Danny is happy to quote, with the source and a date.
- `pages.json`: heading, description and intro text per page, plus the home headline and
  subline, the About story and the privacy and terms text.

The same run composes the share cards under `public/og/` (git-ignored) from the photos and
the mark in `public/brand/mark.png`, and the offline game shell.

Fields left out of the JSON take the schema defaults; the CMS is configured to omit empty
optional fields rather than write `null` or `""`, so hand-written and CMS-written entries
look alike.
