/**
 * Build-time Open Graph cards. The site runs on Cloudflare Workers with no runtime image
 * generation, so every social card is a static JPEG under public/og, composed here with
 * sharp from the processed photos and the brand mark. No text is drawn anywhere: fonts
 * are not reliable on the build machine, so the mark comes from public/brand/mark.png,
 * tinted bone through its alpha.
 *
 * Outputs (all 1200x630 JPEG):
 *   public/og/site.jpg, services.jpg, process.jpg, work.jpg, about.jpg, contact.jpg, play.jpg
 *   public/og/services/<slug>.jpg   one per published service
 */
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

import type { ProcessStep, ProcessedImage, Service, SiteSettings, WorkPair } from "../src/lib/content/schema";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const OG_DIR = path.join(PUBLIC_DIR, "og");
const MARK_SRC = path.join(PUBLIC_DIR, "brand", "mark.png");
const SELF = path.join(ROOT, "scripts", "og-images.ts");

const WIDTH = 1200;
const HEIGHT = 630;
const JPEG_QUALITY = 82;

const INK = "#06080f";
const BONE = "#eef1f6";
const BLUE = "#2247d6";

/** The processed tier the cards are built from: 1024 wide, or the largest below it. */
const SOURCE_TIER = 1024;

type Layer = OverlayOptions;
type Placed = { data: Buffer; width: number; height: number };

function sourceFile(image: ProcessedImage) {
  const tier = image.sizes.find((s) => s.width >= SOURCE_TIER) ?? image.sizes[image.sizes.length - 1]!;
  return path.join(PUBLIC_DIR, ...tier.src.split("/"));
}

async function isFresh(out: string, deps: string[]) {
  try {
    const [o, ...ds] = await Promise.all([stat(out), ...deps.map((d) => stat(d))]);
    return ds.every((d) => o.mtimeMs >= d.mtimeMs);
  } catch {
    return false;
  }
}

/** The mark's coverage as a single-channel image, trimmed to its ink. */
async function loadMask(file: string) {
  const alpha = await sharp(file).ensureAlpha().extractChannel(3).png().toBuffer();
  return sharp(alpha).trim().png().toBuffer();
}

/** The mark resized to `size` and filled with a flat colour through its coverage. */
async function tintMark(mask: Buffer, size: { width?: number; height?: number }, color: string): Promise<Placed> {
  const { data, info } = await sharp(mask).resize({ ...size, fit: "inside" }).png().toBuffer({ resolveWithObject: true });
  const tinted = await sharp({ create: { width: info.width, height: info.height, channels: 3, background: color } })
    .joinChannel(data)
    .png()
    .toBuffer();
  return { data: tinted, width: info.width, height: info.height };
}

/** A photo cover-fitted into a box, darkened a touch so the mark reads over it. */
async function coverImage(image: ProcessedImage, box: { width: number; height: number }): Promise<Placed> {
  const { data, info } = await sharp(sourceFile(image))
    .resize(box.width, box.height, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.82 })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function glow(cx: number, cy: number, rx: number, ry: number, color: string, opacity: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs><radialGradient id="g"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="0.55" stop-color="${color}" stop-opacity="${opacity * 0.45}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#g)"/>
</svg>`;
  return Buffer.from(svg);
}

/** Ink fading up from the bottom so the mark sits on something quiet. */
function scrim() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity="0.92"/></linearGradient></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#s)"/>
</svg>`;
  return Buffer.from(svg);
}

/** A thin accent rule under the mark. */
function rule(left: number, top: number, width: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect x="${left}" y="${top}" width="${width}" height="4" fill="${BLUE}"/></svg>`;
  return Buffer.from(svg);
}

async function writeCard(out: string, layers: Layer[]) {
  await mkdir(path.dirname(out), { recursive: true });
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: INK } })
    .composite(layers)
    .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(out);
}

class Marks {
  private mask: Buffer | undefined;
  private cache = new Map<string, Promise<Placed>>();
  mark(size: { width?: number; height?: number }) {
    const key = `${size.width ?? ""}x${size.height ?? ""}`;
    let p = this.cache.get(key);
    if (!p) {
      p = (async () => {
        this.mask ??= await loadMask(MARK_SRC);
        return tintMark(this.mask, size, BONE);
      })();
      this.cache.set(key, p);
    }
    return p;
  }
}

/** The home card: the mark large and centred on ink with a blue glow behind it. */
async function siteCard(marks: Marks, out: string) {
  const mark = await marks.mark({ width: 620 });
  const left = Math.round((WIDTH - mark.width) / 2);
  const top = Math.round((HEIGHT - mark.height) / 2) - 10;
  await writeCard(out, [
    { input: glow(WIDTH / 2, HEIGHT / 2, 520, 300, BLUE, 0.28) },
    { input: mark.data, left, top },
    { input: rule(left, top + mark.height + 28, mark.width) },
  ]);
}

/** A photo card: the photo full bleed, an ink scrim, the mark bottom-left. */
async function photoCard(marks: Marks, image: ProcessedImage, out: string) {
  const photo = await coverImage(image, { width: WIDTH, height: HEIGHT });
  const mark = await marks.mark({ height: 96 });
  const pad = 56;
  await writeCard(out, [
    { input: photo.data, left: 0, top: 0 },
    { input: scrim() },
    { input: mark.data, left: pad, top: HEIGHT - pad - mark.height },
    { input: rule(pad, HEIGHT - pad + 20, mark.width) },
  ]);
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  });
  await Promise.all(workers);
}

async function prune(dir: string, keep: Set<string>) {
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }
  for (const f of files) if (!keep.has(f)) await unlink(path.join(dir, f));
}

type Progress = { label: string; total: number; regenerated: string[] };

async function build(p: Progress, out: string, deps: string[], make: () => Promise<void>) {
  p.total++;
  if (await isFresh(out, deps)) return;
  await make();
  p.regenerated.push(path.basename(out));
}

function report(p: Progress) {
  const n = p.regenerated.length;
  console.log(`  ✓ ${p.label}: ${p.total} card(s), ${n === 0 ? "all fresh" : `${n} regenerated`}`);
}

export async function generateOgImages(content: {
  settings: SiteSettings;
  services: Service[];
  steps: ProcessStep[];
  work: WorkPair[];
}) {
  await mkdir(OG_DIR, { recursive: true });
  const marks = new Marks();
  const contentDeps = ["services.json", "process.json", "work.json", "settings.json"].map((f) =>
    path.join(ROOT, "content", f),
  );
  const brandDeps = [MARK_SRC, SELF, ...contentDeps];
  const at = (name: string) => path.join(OG_DIR, `${name}.jpg`);

  const cardFor = async (p: Progress, out: string, image: ProcessedImage | undefined) => {
    if (image) {
      await build(p, out, [sourceFile(image), ...brandDeps], () => photoCard(marks, image, out));
    } else {
      await build(p, out, brandDeps, () => siteCard(marks, out));
    }
  };

  const services = { label: "og/services", total: 0, regenerated: [] as string[] };
  await pool(content.services, 4, (s) => cardFor(services, path.join(OG_DIR, "services", `${s.slug}.jpg`), s.image));
  await prune(path.join(OG_DIR, "services"), new Set(content.services.map((s) => `${s.slug}.jpg`)));
  report(services);

  const site = { label: "og site", total: 0, regenerated: [] as string[] };
  const firstPhoto = (items: { image?: ProcessedImage }[]) => items.find((i) => i.image)?.image;
  await build(site, at("site"), brandDeps, () => siteCard(marks, at("site")));
  await cardFor(site, at("services"), firstPhoto(content.services));
  await cardFor(site, at("process"), firstPhoto(content.steps));
  await cardFor(site, at("work"), content.work[0]?.after);
  await cardFor(site, at("about"), content.settings.portrait);
  await cardFor(site, at("contact"), content.settings.unitPhoto ?? content.settings.portrait);
  await build(site, at("play"), brandDeps, () => siteCard(marks, at("play")));
  report(site);
}
