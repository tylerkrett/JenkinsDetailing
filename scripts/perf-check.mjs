// Scrolls the corridor three times and samples draw calls, GPU resources and JS heap.
// Flat resource counts across passes prove virtualisation and disposal work.
// Usage: node scripts/perf-check.mjs <url> [passes]
import { chromium } from "playwright-core";

const [url, passesArg = "3"] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
await page.mouse.move(720, 450);

const sample = async (label) => {
  const s = await page.evaluate(() => {
    const h = window.__jd?.stats?.() ?? {};
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    return { ...h, heapMB: mem, y: Math.round(window.scrollY) };
  });
  console.log(label.padEnd(14), JSON.stringify(s));
  return s;
};

const height = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const maxCalls = [];
for (let p = 1; p <= Number(passesArg); p++) {
  let peak = 0;
  for (let y = 0; y <= height; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(250);
    const s = await sample(`pass${p} y=${y}`);
    peak = Math.max(peak, s.calls ?? 0);
  }
  maxCalls.push(peak);
  await page.keyboard.press("Home");
  await page.waitForTimeout(1500);
  await sample(`pass${p} end`);
}
console.log("\npeak draw calls per pass:", maxCalls.join(", "));
await browser.close();
