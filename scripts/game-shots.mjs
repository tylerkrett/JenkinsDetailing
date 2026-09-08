// Screenshots of Too Street with the locally installed Chrome: title, mid-run and game over,
// at phone and desktop sizes. Usage: node scripts/game-shots.mjs [baseUrl] [outDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const [base = "http://localhost:3100/play", outDir = "/tmp/jd-game"] =
  process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "laptop", width: 1280, height: 720, mobile: false },
  { name: "desktop", width: 1440, height: 900, mobile: false },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const s of sizes) {
  const context = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    hasTouch: s.mobile,
    isMobile: s.mobile,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  // A fixed seed keeps the run identical between shots.
  await page.goto(`${base}${base.includes("?") ? "&" : "?"}seed=7`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const canvas = page.locator('canvas[aria-label^="Too Street"]').first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  console.log(`${s.name}: canvas ${Math.round(box?.width ?? 0)} x ${Math.round(box?.height ?? 0)} css px`);
  await page.screenshot({ path: `${outDir}/${s.name}-title.png` });

  // Start and play for a while with a naive auto-jumper so there is something to see.
  await page.keyboard.press("Space");
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    await page.keyboard.down("Space");
    await page.waitForTimeout(140);
    await page.keyboard.up("Space");
    await page.waitForTimeout(520);
  }
  await page.screenshot({ path: `${outDir}/${s.name}-run.png` });
  // Stop jumping and let the street win.
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${outDir}/${s.name}-over.png` });
  console.log(`${s.name}: saved title, run, over`);
  if (errors.length) console.log(`${s.name} console errors:\n` + errors.map((e) => "  " + e).join("\n"));
  await context.close();
}
await browser.close();
