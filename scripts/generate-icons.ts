/**
 * Generates every favicon / PWA icon from the brand mark in public/brand.
 * The mark is on transparent, so each icon is composed on the site's ink
 * background. Run with `pnpm icons` whenever the mark changes.
 *
 * Outputs:
 *   src/app/favicon.ico        16/32/48 (PNG-encoded ICO)  -> /favicon.ico
 *   src/app/icon.png           512x512                      -> <link rel="icon">
 *   src/app/apple-icon.png     180x180                      -> apple-touch-icon
 *   public/icons/icon-192.png  PWA "any"
 *   public/icons/icon-512.png  PWA "any"
 *   public/icons/maskable-512.png  PWA "maskable" (extra safe-zone padding)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "public/brand/mark.png");
const BACKGROUND = "#06080f";

/** Signature rendered on the ink background, centred in a square of `size` px. */
async function render(size: number, inset: number): Promise<Buffer> {
  const box = Math.round(size * (1 - inset * 2));
  const mark = await sharp(SOURCE)
    .trim()
    .resize(box, box, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** ICO container holding PNG-encoded entries (supported by every modern browser). */
function buildIco(entries: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dirSize = 16 * entries.length;
  let offset = 6 + dirSize;
  const dir: Buffer[] = [];
  for (const { size, png } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    dir.push(entry);
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

async function main() {
  const app = path.join(ROOT, "src/app");
  const icons = path.join(ROOT, "public/icons");
  await mkdir(icons, { recursive: true });

  // Standard icons: the mark sits in the square with a little breathing room.
  const STANDARD_INSET = 0.1;
  // Maskable icons get cropped to a circle/squircle by the OS, so keep the mark inside
  // the 80% safe zone.
  const MASKABLE_INSET = 0.18;

  const [ico16, ico32, ico48] = await Promise.all(
    [16, 32, 48].map((s) => render(s, 0.06)),
  );
  await writeFile(
    path.join(app, "favicon.ico"),
    buildIco([
      { size: 16, png: ico16! },
      { size: 32, png: ico32! },
      { size: 48, png: ico48! },
    ]),
  );

  await writeFile(
    path.join(app, "icon.png"),
    await render(512, STANDARD_INSET),
  );
  await writeFile(
    path.join(app, "apple-icon.png"),
    await render(180, STANDARD_INSET),
  );
  await writeFile(
    path.join(icons, "icon-192.png"),
    await render(192, STANDARD_INSET),
  );
  await writeFile(
    path.join(icons, "icon-512.png"),
    await render(512, STANDARD_INSET),
  );
  await writeFile(
    path.join(icons, "maskable-512.png"),
    await render(512, MASKABLE_INSET),
  );

  console.log("Icons written to src/app and public/icons");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
