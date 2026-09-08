// Frames at given world units. Usage: node u-shots.mjs <url> <outDir> u1 u2 ...
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
const [url, outDir, ...us] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(outDir, { recursive: true });
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForFunction(() => window.__jd?.scene?.().ready === true, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__jdNoSnap = true; });
const unit = (1.6 / 26) * 900;
for (const u of us.map(Number)) {
  await page.evaluate((y) => window.scrollTo(0, y), u * unit);
  await page.waitForTimeout(1800);
  const s = await page.evaluate(() => window.__jd?.scene?.());
  console.log(u, s.progress.toFixed(4), "station", s.station);
  await page.screenshot({ path: `${outDir}/u-${u}.png` });
}
await browser.close();
