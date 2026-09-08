// Screenshot the bay at every act's hold. Usage: node scripts/bay-shots.mjs <url> <outDir> [w] [h]
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const [url, outDir, w = "1440", h = "900"] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await mkdir(outDir, { recursive: true });
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForFunction(() => window.__jd?.scene?.().ready === true, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);
console.log("start", JSON.stringify(await page.evaluate(() => window.__jd?.scene?.())));
await page.screenshot({ path: `${outDir}/act-0.png` });
const slugs = await page.evaluate(() => Array.from(document.querySelectorAll("main > section[id]")).map((s) => s.id));
for (const [i, slug] of slugs.entries()) {
  // Each act's spacer section starts at its hold; the dwell runs over the first 12/26 of it.
  for (const [label, frac] of [["", 0.002], ["-mid", (12 / 26) * 0.55]]) {
    await page.evaluate(({ slug, frac }) => {
      const el = document.getElementById(slug);
      window.scrollTo(0, el.offsetTop + frac * el.offsetHeight);
    }, { slug, frac });
    await page.waitForTimeout(2200);
    const s = await page.evaluate(() => window.__jd?.scene?.());
    console.log(i + 1, slug, label, JSON.stringify(s));
    await page.screenshot({ path: `${outDir}/act-${i + 1}-${slug}${label}.png` });
  }
}
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/end.png` });
if (errors.length) console.log("console errors:\n" + errors.slice(0, 8).map((e) => "  " + e).join("\n"));
await browser.close();
