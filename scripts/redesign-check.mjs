// End-to-end check of the site against a running server: every page at three widths
// (screenshots, axe, no canvas, no three.js, no sideways scroll), then the watch page's
// 3D | Plain switch, the /process redirect, the keyboard paths and the quote form.
// Usage: node scripts/redesign-check.mjs [base=http://localhost:3105] [--no-3d]
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3105").replace(/\/$/, "");
const skip3d = args.includes("--no-3d");
const only3d = args.includes("--only-3d");
const OUT = ".playwright-mcp/redesign";
const GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

const services = JSON.parse(await readFile("content/services.json", "utf8")).filter((s) => s.published !== false);
const ROUTES = [
  "/",
  "/services",
  ...services.map((s) => `/services/${s.slug}`),
  "/about",
  "/work",
  "/contact",
  "/watch?view=plain",
  "/privacy",
  "/terms",
];

const failures = [];
const step = (label) => console.log(`• ${label}`);
const viewCookie = async (context) => (await context.cookies()).find((c) => c.name === "jd-view")?.value;
const noThree = (page) => page.evaluate(() => !("__THREE__" in window) && !document.querySelector("canvas"));

await mkdir(OUT, { recursive: true });
let axe = null;
try {
  const res = await fetch("https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js");
  if (res.ok) axe = await res.text();
} catch {
  // Offline: the accessibility pass is skipped and reported below.
}

if (!only3d) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    // ---------------------------------------------------------------------------------
    // Every page, three widths, reduced motion (so nothing is mid-fade in a screenshot)
    // ---------------------------------------------------------------------------------
    const calm = await browser.newContext({ reducedMotion: "reduce" });
    calm.setDefaultNavigationTimeout(120000);
    const page = await calm.newPage();
    page.on("pageerror", (e) => failures.push(`page error on ${page.url()}: ${e.message}`));
    page.on("console", (m) => {
      // The 404 check's own failed load is expected.
      if (m.type() === "error" && !page.url().includes("/no-such-page"))
        failures.push(`console error on ${page.url()}: ${m.text().slice(0, 300)}`);
    });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        const res = await page.goto(base + route, { waitUntil: "networkidle", timeout: 120000 });
        assert.equal(res?.status(), 200, `${route} status`);
        assert(await noThree(page), `${route} loaded three.js or a canvas`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert(overflow <= 1, `${route} scrolls sideways at ${width}px (${overflow}px)`);
        const name = route === "/" ? "home" : route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
        await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true });
        if (axe) {
          await page.addScriptTag({ content: axe });
          const serious = await page.evaluate(async () =>
            (await window.axe.run()).violations
              .filter((v) => v.impact === "serious" || v.impact === "critical")
              .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
          );
          if (serious.length) failures.push(`${route} at ${width}px: ${serious.join("; ")}`);
        }
      }
      step(`${ROUTES.length} pages at ${width}px: status, no three.js, no overflow${axe ? ", axe" : ""}`);
    }
    if (!axe) console.warn("! axe-core could not be downloaded; the accessibility pass was skipped");

    const missing = await page.goto(`${base}/no-such-page`, { waitUntil: "networkidle" });
    assert.equal(missing?.status(), 404);
    await page.screenshot({ path: `${OUT}/not-found-1440.png` });
    step("404 page");

    // ---------------------------------------------------------------------------------
    // The switch where 3D cannot run: reduced motion, no WebGL, data saver
    // ---------------------------------------------------------------------------------
    await page.goto(`${base}/watch?view=plain`, { waitUntil: "networkidle" });
    assert.equal(await viewCookie(calm), "plain", "?view=plain sets the cookie");
    await page.goto(`${base}/watch?view=3d`, { waitUntil: "networkidle" });
    assert.equal(await viewCookie(calm), "3d", "?view=3d sets the cookie");
    assert(await noThree(page), "reduced motion must get the plain page even when 3D was chosen");
    assert(await page.getByRole("button", { name: "3D", exact: true }).isDisabled());
    assert.equal(await page.getByRole("button", { name: "Plain", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByText("3D is not available on this device").waitFor();
    step("reduced motion: plain, 3D disabled, ?view= sets the cookie");

    const res = await page.goto(`${base}/process`, { waitUntil: "networkidle" });
    assert(page.url().endsWith("/watch?view=plain"), `/process lands on ${page.url()}`);
    assert.equal(res?.status(), 200);
    step("/process redirects to /watch?view=plain");

    for (const [label, options, init] of [
      ["no WebGL", {}, () => (HTMLCanvasElement.prototype.getContext = () => null)],
      ["Save-Data", { extraHTTPHeaders: { "Save-Data": "on" } }, null],
    ]) {
      const context = await browser.newContext(options);
      context.setDefaultNavigationTimeout(120000);
      if (init) await context.addInitScript(init);
      const p = await context.newPage();
      await p.goto(`${base}/watch?view=3d`, { waitUntil: "networkidle" });
      assert(await noThree(p), `${label}: no scene`);
      assert(await p.getByRole("button", { name: "3D", exact: true }).isDisabled(), `${label}: 3D disabled`);
      assert(await p.getByRole("heading", { level: 1 }).isVisible(), `${label}: the plain page shows`);
      await context.close();
      step(`${label}: plain page, 3D disabled`);
    }

    // ---------------------------------------------------------------------------------
    // Keyboard: a home step tile opens that step on /watch; the quote form's radios
    // ---------------------------------------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.locator('a[href="/watch?act=5"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/watch\?act=5$/);
    await page.waitForFunction(() => {
      const r = document.getElementById("correct")?.getBoundingClientRect();
      return Boolean(r && r.top >= 0 && r.top < window.innerHeight / 2);
    });
    step("keyboard: step tile 5 opens /watch?act=5 at that step");

    await page.goto(`${base}/contact`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Request a quote", exact: true }).click();
    assert.equal(await page.locator("input[name=name]").getAttribute("aria-invalid"), "true");
    assert(
      await page.locator("input[name=name]").evaluate((el) => el === document.activeElement),
      "focus moves to the first error",
    );
    await page.getByLabel("Small car", { exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    assert(await page.getByLabel("Medium car", { exact: true }).isChecked(), "arrow keys move through the sizes");
    await page.getByLabel("At my address", { exact: true }).check();
    assert(await page.getByLabel("Postcode", { exact: true }).isVisible());
    await page.getByLabel("Paint correction", { exact: true }).check();
    assert(await page.getByLabel("Paint correction", { exact: true }).isChecked());
    step("quote form: errors focus, segmented controls by keyboard, postcode for home visits, service chips");
    await calm.close();
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------
// The 3D view itself, in a browser with (software) WebGL
// ---------------------------------------------------------------------------------
if (!skip3d) {
  const gl = await chromium.launch({ channel: "chrome", headless: true, args: GL_ARGS });
  try {
    const context = await gl.newContext({ viewport: { width: 1440, height: 900 } });
    context.setDefaultNavigationTimeout(180000);
    const page = await context.newPage();
    page.on("pageerror", (e) => failures.push(`page error on ${page.url()}: ${e.message}`));
    const sceneUp = () =>
      page.waitForFunction(() => "__THREE__" in window && document.querySelector("canvas"), null, { timeout: 180000 });
    const sceneGone = () => page.waitForFunction(() => !document.querySelector("canvas"), null, { timeout: 30000 });
    const pressed = (name) => page.getByRole("button", { name, exact: true }).getAttribute("aria-pressed");

    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    assert(await noThree(page), "the home page must not load three.js even where WebGL works");
    await page.goto(`${base}/services/detailing`, { waitUntil: "networkidle" });
    assert(await noThree(page));
    step("WebGL browser: home and a service page load no three.js");

    await page.goto(`${base}/watch`, { waitUntil: "networkidle", timeout: 180000 });
    await sceneUp();
    assert.equal(await pressed("3D"), "true");
    step("no saved choice and a capable device: /watch opens in 3D");

    // Software WebGL starves the frame loop, so Playwright's "stable for two frames" wait
    // never settles while the scene runs; fire the click directly.
    await page.getByRole("button", { name: "Plain", exact: true }).dispatchEvent("click");
    await sceneGone();
    assert.equal(await viewCookie(context), "plain");
    assert(await page.getByRole("heading", { level: 1 }).isVisible());
    const leftovers = await page.evaluate(() => ({
      overflow: document.body.style.overflow,
      paged: "paged" in document.documentElement.dataset,
    }));
    assert.deepEqual(leftovers, { overflow: "", paged: false }, "the scene must not leave scroll locks behind");
    step("switch to Plain: scene unmounts cleanly, cookie saved");

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2500);
    assert(!(await page.locator("canvas").count()), "plain must survive a reload");
    assert.equal(await pressed("Plain"), "true");
    const tab = await context.newPage();
    await tab.goto(`${base}/watch`, { waitUntil: "load" });
    await tab.waitForTimeout(2500);
    assert(!(await tab.locator("canvas").count()), "plain must hold in a new tab");
    await tab.close();
    step("Plain survives a reload and a new tab");

    await page.waitForFunction(() => [...document.querySelectorAll(".view-switch button")].every((b) => !b.disabled));
    await page.getByRole("button", { name: "3D", exact: true }).focus();
    await page.keyboard.press("Space");
    await sceneUp();
    assert.equal(await viewCookie(context), "3d");
    await page.reload({ waitUntil: "load", timeout: 180000 });
    await sceneUp();
    step("keyboard: Space on 3D brings the scene back, and it survives a reload");

    await page.goto(`${base}/watch?act=5`, { waitUntil: "load", timeout: 180000 });
    await sceneUp();
    // The dev-only probe registers once the canvas has rendered; production has none.
    const dev = await page
      .waitForFunction(() => typeof window.__jd?.scene === "function", null, { timeout: 30000 })
      .then(
        () => true,
        () => false,
      );
    if (dev) {
      await page.waitForFunction(() => window.__jd.scene().ready === true, null, { timeout: 120000 });
      await page.waitForFunction(() => window.__jd.scene().station === 4, null, { timeout: 20000 });
      step("?act=5 opens the scene at act 5");
    } else {
      step("?act=5 (station check needs the dev server; skipped)");
    }
    await page.screenshot({ path: `${OUT}/watch-3d-1440.png`, timeout: 120000 });
  } finally {
    await gl.close();
  }
}

assert.deepEqual(failures, [], `\n${failures.join("\n")}`);
console.log("\nPASS");
