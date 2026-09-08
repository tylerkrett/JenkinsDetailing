/**
 * Build-time content pipeline. Validates content/*.json, processes every photo into a
 * WebP size ladder under public/photos-derived, extracts what the pages need
 * (dimensions, dominant colour, LQIP) and writes the *.generated.json files. Finally
 * composes the static Open Graph cards under public/og (see scripts/og-images.ts).
 *
 * Runs on `predev`, `prebuild` and `pretypecheck`. A bad edit fails the build here,
 * with a readable error, rather than shipping a broken site.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";

import {
  packagesSchema,
  pagesSchema,
  type ProcessStep,
  type ProcessedImage,
  processInputSchema,
  processStepSchema,
  reviewsSchema,
  type Service,
  serviceSchema,
  servicesInputSchema,
  settingsGeneratedSchema,
  settingsSchema,
  type WorkPair,
  workListInputSchema,
  workSchema,
} from "../src/lib/content/schema";
import { generateOgImages } from "./og-images";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content");
const PUBLIC_DIR = path.join(ROOT, "public");
const PHOTO_SRC = path.join(PUBLIC_DIR, "photos");
const PHOTO_OUT = path.join(PUBLIC_DIR, "photos-derived");

/** Widths emitted per image. 4096 is only reached by before-and-after pairs. Nothing is upscaled. */
const LADDER = [480, 1024, 2048] as const;
const LADDER_ZOOM = [480, 1024, 2048, 4096] as const;
const WEBP_QUALITY = 82;
const LQIP_SIZE = 24;

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(CONTENT_DIR, file), "utf8"));
}

function fail(label: string, error: z.ZodError): never {
  console.error(`\n✖ content/${label} is invalid:\n`);
  for (const issue of error.issues) {
    console.error(`  • ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

function parseOrFail<S extends z.ZodTypeAny>(label: string, schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) fail(label, result.error);
  return result.data as z.output<S>;
}

async function isFresh(out: string, src: string) {
  try {
    const [o, s] = await Promise.all([stat(out), stat(src)]);
    return o.mtimeMs >= s.mtimeMs;
  } catch {
    return false;
  }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The most present vivid colour in a photo, for placeholders and card glows: pixels are
 * binned and each bin scored by frequency, saturation and mid-lightness.
 */
async function vibrantColor(src: string) {
  const { data, info } = await sharp(src)
    .rotate()
    .resize(96, 96, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  let best = { score: -1, r: 0, g: 0, b: 0 };
  for (const bin of bins.values()) {
    const r = bin.r / bin.n / 255, g = bin.g / bin.n / 255, b = bin.b / bin.n / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    const mid = 1 - Math.abs(l - 0.5) * 2;
    const score = Math.pow(bin.n, 0.3) * sat * Math.pow(mid, 0.5);
    if (score > best.score) best = { score, r: r * 255, g: g * 255, b: b * 255 };
  }
  return toHex({ r: Math.round(best.r), g: Math.round(best.g), b: Math.round(best.b) });
}

function publicUrl(file: string) {
  return "/" + path.relative(PUBLIC_DIR, file).split(path.sep).join("/");
}

/** Processed once per source file; the same photo can be used by several collections. */
const cache = new Map<string, Promise<ProcessedImage>>();

function processImage(file: string, zoom = false): Promise<ProcessedImage> {
  const key = `${file}:${zoom ? "zoom" : "web"}`;
  let p = cache.get(key);
  if (!p) {
    p = processImageUncached(file, zoom);
    cache.set(key, p);
  }
  return p;
}

async function processImageUncached(file: string, zoom: boolean): Promise<ProcessedImage> {
  const src = path.join(PHOTO_SRC, file);
  // Output mirrors the source folder so two photos with one name in different folders never collide.
  const outDir = path.join(PHOTO_OUT, path.dirname(file));
  const base = path.parse(file).name;
  await mkdir(outDir, { recursive: true });

  // `.rotate()` with no argument applies EXIF orientation; metadata() reports the
  // pre-rotation size, so swap for the orientations that turn the image sideways.
  const meta = await sharp(src).metadata();
  if (!meta.width || !meta.height) throw new Error(`${file}: unreadable image`);
  const sideways = (meta.orientation ?? 1) >= 5;
  const width = sideways ? meta.height : meta.width;
  const height = sideways ? meta.width : meta.height;

  const dominantColor = await vibrantColor(src);
  const lqipBuffer = await sharp(src)
    .rotate()
    .resize(LQIP_SIZE, LQIP_SIZE, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();

  const sizes: ProcessedImage["sizes"] = [];
  for (const target of zoom ? LADDER_ZOOM : LADDER) {
    const w = Math.min(target, width);
    const out = path.join(outDir, `${base}-${w}.webp`);
    if (!(await isFresh(out, src))) {
      await sharp(src)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(out);
    }
    sizes.push({ width: w, src: publicUrl(out) });
    if (w < target) break;
  }

  return {
    width,
    height,
    aspect: width / height,
    dominantColor,
    lqip: `data:image/webp;base64,${lqipBuffer.toString("base64")}`,
    sizes,
  };
}

async function optionalImage(file: string | undefined) {
  return file ? processImage(file) : undefined;
}

function writeGenerated(name: string, data: unknown) {
  return writeFile(path.join(CONTENT_DIR, `${name}.generated.json`), JSON.stringify(data, null, 2) + "\n");
}

async function main() {
  const settingsIn = parseOrFail("settings.json", settingsSchema, await readJson("settings.json"));
  parseOrFail("pages.json", pagesSchema, await readJson("pages.json"));
  const packages = parseOrFail("packages.json", packagesSchema, await readJson("packages.json"));
  parseOrFail("reviews.json", reviewsSchema, await readJson("reviews.json"));
  const servicesIn = parseOrFail("services.json", servicesInputSchema, await readJson("services.json"));
  const processIn = parseOrFail("process.json", processInputSchema, await readJson("process.json"));
  const workIn = parseOrFail("work.json", workListInputSchema, await readJson("work.json"));

  const settings = settingsGeneratedSchema.parse({
    ...settingsIn,
    portrait: await optionalImage(settingsIn.portrait),
    unitPhoto: await optionalImage(settingsIn.unitPhoto),
  });
  await writeGenerated("settings", settings);
  console.log("  ✓ settings");

  const services: Service[] = [];
  for (const input of [...servicesIn].filter((s) => s.published).sort((a, b) => a.sortOrder - b.sortOrder)) {
    const { image, gallery, ...rest } = input;
    services.push(
      serviceSchema.parse({
        ...rest,
        image: await optionalImage(image),
        gallery: await Promise.all(gallery.map((g) => processImage(g))),
      }),
    );
    console.log(`  ✓ service  ${input.slug}`);
  }
  await writeGenerated("services", services);
  const serviceSlugs = new Set(services.map((s) => s.slug));
  for (const p of packages) {
    if (!serviceSlugs.has(p.service)) console.warn(`  ! packages.json: "${p.slug}" points at unknown service "${p.service}"`);
  }

  const steps: ProcessStep[] = [];
  const ordered = [...processIn].sort((a, b) => a.act - b.act || a.sortOrder - b.sortOrder);
  for (const [index, input] of ordered.entries()) {
    const { image, ...rest } = input;
    if (rest.service && !serviceSlugs.has(rest.service))
      console.warn(`  ! process.json: "${rest.slug}" points at unknown service "${rest.service}"`);
    steps.push(processStepSchema.parse({ ...rest, index, image: await optionalImage(image) }));
    console.log(`  ✓ step     ${String(input.act)}  ${input.slug}`);
  }
  await writeGenerated("process", steps);

  const work: WorkPair[] = [];
  for (const input of [...workIn].filter((w) => w.published).sort((a, b) => a.sortOrder - b.sortOrder)) {
    const { before, after, ...rest } = input;
    work.push(
      workSchema.parse({
        ...rest,
        before: await processImage(before, true),
        after: await processImage(after, true),
      }),
    );
    console.log(`  ✓ work     ${input.slug}`);
  }
  await writeGenerated("work", work);

  console.log(`\n${services.length} service(s), ${steps.length} step(s), ${work.length} pair(s) prepared.\n`);
  await generateOgImages({ settings, services, steps, work });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
