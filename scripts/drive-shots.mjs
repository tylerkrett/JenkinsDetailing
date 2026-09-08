// Frames along the opening scroll, snap off, to check the drive-in. Usage: node scripts/drive-shots.mjs <url> <outDir>
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
const [url, outDir] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(outDir, { recursive: true });
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForFunction(() => window.__jd?.scene?.().ready === true, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__jdNoSnap = true; });
// The opening: road (0..20 units), the forecourt hold and pull-in (20..32), the fly-in
// to the wash hold (32..46).
const unit = (1.6 / 26) * 900;
for (const k of [0, 5, 10, 15, 20, 24, 28, 32, 37, 41, 46]) {
  await page.evaluate((y) => window.scrollTo(0, y), k * unit);
  await page.waitForTimeout(1800);
  const s = await page.evaluate(() => window.__jd?.scene?.());
  console.log(k, s.progress.toFixed(4), "station", s.station);
  await page.screenshot({ path: `${outDir}/drive-${String(k).padStart(2, "0")}.png` });
}
await browser.close();
