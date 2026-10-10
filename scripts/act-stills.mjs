// One still per act from the 3D bay, without the UI, at 2x, into public/photos/acts/<slug>.jpg.
// They stand in on the home page and for services without photos. Run against the dev
// server (it needs window.__jdGo), then `pnpm content`.
// Usage: node scripts/act-stills.mjs [http://localhost:3105/watch]
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:3105/watch";
const steps = JSON.parse(await readFile("content/process.json", "utf8")).sort((a, b) => a.act - b.act);
await mkdir("public/photos/acts", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(() => window.__jd?.scene().ready && window.__jd?.scene().active, null, {
    timeout: 120000,
  });
  await page.addStyleTag({
    content: "body * { visibility: hidden !important; } canvas, canvas * { visibility: visible !important; }",
  });
  for (const [i, step] of steps.entries()) {
    await page.evaluate((i) => window.__jdGo(i), i);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `public/photos/acts/${step.slug}.jpg`, type: "jpeg", quality: 86, timeout: 120000 });
    console.log(`Captured ${step.slug}`);
  }
} finally {
  await browser.close();
}
