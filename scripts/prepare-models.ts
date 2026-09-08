/**
 * Build-time model pipeline. Reads the source glTF in models-src/, cleans it, trims the
 * heaviest meshes, resizes and WebP-encodes the textures, meshopt-compresses the
 * geometry and writes a desktop and a mobile variant to public/models/ under a
 * content-hashed name (so the immutable cache header is safe). Writes
 * content/models.generated.json with the two paths and the byte sizes.
 *
 * Runs as part of `pnpm content`. Skips the work when the outputs are newer than the
 * source and this script.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "models-src", "car.glb");
const OUT_DIR = path.join(ROOT, "public", "models");
const MANIFEST = path.join(ROOT, "content", "models.generated.json");
const SELF = path.join(ROOT, "scripts", "prepare-models.ts");

type Variant = { name: "desktop" | "mobile"; textureSize: number; simplifyRatio: number };
const VARIANTS: Variant[] = [
  { name: "desktop", textureSize: 2048, simplifyRatio: 0.7 },
  { name: "mobile", textureSize: 1024, simplifyRatio: 0.45 },
];

async function isFresh(outs: string[], deps: string[]) {
  try {
    const os = await Promise.all(outs.map((o) => stat(o)));
    const ds = await Promise.all(deps.map((d) => stat(d)));
    return os.every((o) => ds.every((d) => o.mtimeMs >= d.mtimeMs));
  } catch {
    return false;
  }
}

async function build(document: Document, v: Variant) {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  await document.transform(
    dedup(),
    prune(),
    weld(),
    resample(),
    // One error-bounded pass: the wipers, rims and brake pads carry most of the excess and
    // collapse the furthest; body panels keep their silhouettes inside the error bound.
    simplify({ simplifier: MeshoptSimplifier, ratio: v.simplifyRatio, error: 0.001 }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [v.textureSize, v.textureSize], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
}

async function main() {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  await mkdir(OUT_DIR, { recursive: true });

  let manifest: Record<string, { src: string; bytes: number }> = {};
  try {
    manifest = JSON.parse(await readFile(MANIFEST, "utf8")) as typeof manifest;
  } catch {
    manifest = {};
  }
  const existing = Object.values(manifest).map((m) => path.join(ROOT, "public", ...m.src.split("/")));
  if (existing.length === VARIANTS.length && (await isFresh([...existing, MANIFEST], [SRC, SELF]))) {
    console.log("  ✓ models fresh");
    return;
  }

  const srcBytes = await readFile(SRC);
  const keep = new Set<string>();
  for (const v of VARIANTS) {
    const document = await io.readBinary(new Uint8Array(srcBytes));
    // Strip the sample's own branding textures if any material still references them by name.
    for (const m of document.getRoot().listMaterials()) {
      if (/logo|khronos|3d commerce/i.test(m.getName())) m.dispose();
    }
    await build(document, v);
    const glb = await io.writeBinary(document);
    const hash = createHash("sha1").update(glb).digest("hex").slice(0, 10);
    const file = `car-${v.name}-${hash}.glb`;
    await writeFile(path.join(OUT_DIR, file), glb);
    keep.add(file);
    manifest[v.name] = { src: `/models/${file}`, bytes: glb.byteLength };
    console.log(`  ✓ ${file}  ${(glb.byteLength / 1024 / 1024).toFixed(2)} MB`);
  }
  for (const f of await readdir(OUT_DIR)) if (!keep.has(f)) await unlink(path.join(OUT_DIR, f));
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
