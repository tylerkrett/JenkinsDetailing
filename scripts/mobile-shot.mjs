// Emulate a phone (touch, coarse pointer) and screenshot a scene page at a few scroll positions.
import { chromium, devices } from "playwright-core";
const [url, out, ...positions] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight, scene: window.__jd?.scene?.() }));
console.log(JSON.stringify(info));
await page.screenshot({ path: out.replace(".png", "-0.png") });
for (const p of positions) {
  await page.evaluate((p) => window.scrollTo(0, Number(p) * (document.documentElement.scrollHeight - innerHeight)), p);
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => window.__jd?.scene?.());
  console.log(p, JSON.stringify(s));
  await page.screenshot({ path: out.replace(".png", `-${p}.png`) });
}
if (errors.length) console.log("console errors:\n" + errors.slice(0, 5).map((e) => "  " + e).join("\n"));
await browser.close();
