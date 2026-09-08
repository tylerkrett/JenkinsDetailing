// Screenshot a page with the locally installed Chrome. Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [fullPage]
import { chromium } from "playwright-core";

const [url, out, w = "1440", h = "900", full = "false"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full === "true" });
console.log(`saved ${out}`);
if (errors.length) console.log("console errors:\n" + errors.map((e) => "  " + e).join("\n"));
await browser.close();
