/**
 * Builds the offline pieces of the site:
 *   public/offline.html  the Bucket Run game as one self-contained page, served by the
 *                        service worker when a navigation cannot reach the network
 *   public/sw.js         the service worker, versioned by a hash of that shell
 *
 * Runs from the `content` script (so predev, prebuild and pretypecheck all produce it) and
 * standalone as `pnpm game:build`. Both outputs are git-ignored. If the engine is missing
 * (a peer session mid-work) a placeholder shell is written and the chain carries on.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const enginePath = path.join(root, "src/game/engine.ts");
const swPath = path.join(root, "src/game/sw.ts");
const templatePath = path.join(root, "src/game/offline.html");
const outDir = path.join(root, "public");

const PLACEHOLDER = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex"><title>Jenkins Detailing</title>
<style>html{background:#06080f;color:#eef1f6;font:15px/1.5 Figtree,system-ui,sans-serif}
body{min-height:100dvh;display:grid;place-items:center;margin:0;padding:2rem;text-align:center}
button{font:inherit;color:inherit;background:none;border:0;text-decoration:underline;text-decoration-color:#8fa6ff;text-underline-offset:5px;cursor:pointer}</style></head>
<body><div><p>No signal. The page will load when you are back online.</p><p><button onclick="location.reload()">Retry</button></p></div>
<script>addEventListener("online",()=>location.reload())</script></body></html>
`;

async function bundleEngine(): Promise<string> {
  const result = await build({
    entryPoints: [enginePath],
    bundle: true,
    minify: true,
    format: "iife",
    globalName: "__BucketRun",
    target: ["es2020"],
    platform: "browser",
    write: false,
    legalComments: "none",
    logLevel: "silent",
  });
  const code = result.outputFiles[0]?.text ?? "";
  // The template calls window.createGame; the bundle exposes the module namespace.
  return `${code}\nwindow.createGame=(__BucketRun.createGame||__BucketRun.default);`;
}

async function bundleWorker(version: string): Promise<string> {
  const result = await build({
    entryPoints: [swPath],
    bundle: true,
    minify: true,
    format: "iife",
    target: ["es2020"],
    platform: "browser",
    write: false,
    legalComments: "none",
    logLevel: "silent",
    define: { __VERSION__: JSON.stringify(version) },
    // tsconfig checks every .js under the repo; the bundle is generated output, not source.
    banner: { js: "// @ts-nocheck" },
  });
  return result.outputFiles[0]?.text ?? "";
}

async function main() {
  await mkdir(outDir, { recursive: true });
  let html: string;
  if (existsSync(enginePath)) {
    const [template, script] = await Promise.all([readFile(templatePath, "utf8"), bundleEngine()]);
    // Never let the bundle close its own script tag.
    html = template.replace("{{SCRIPT}}", () => script.replace(/<\/script/gi, "<\\/script"));
  } else {
    console.warn("build-game: src/game/engine.ts not found, writing a placeholder offline shell");
    html = PLACEHOLDER;
  }
  await writeFile(path.join(outDir, "offline.html"), html);

  // Content addressed: unchanged shell and worker source keep the same version across
  // deploys, so installed workers and their caches survive a deploy that did not touch them.
  const version = createHash("sha256")
    .update(html)
    .update(await readFile(swPath, "utf8"))
    .digest("hex")
    .slice(0, 12);
  const sw = await bundleWorker(version);
  await writeFile(path.join(outDir, "sw.js"), sw);
  console.log(
    `build-game: offline.html ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB, sw.js ${(Buffer.byteLength(sw) / 1024).toFixed(1)} KB, version ${version}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
