/**
 * Screenshot helper for visual review.
 *
 *   node scripts/capture-screens.mjs <outDir> <label>
 *
 * Requires the local portfolio + Studio services to be running.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || path.join(ROOT, ".resource-studio/qa/screens");
const label = process.argv[3] || "capture";

const { chromium } = await import("playwright");

async function launch() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true, timeout: 20000 });
  } catch {
    const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    try {
      await (await import("node:fs/promises")).access(edge);
      return chromium.launch({ executablePath: edge, headless: true, timeout: 20000 });
    } catch { /* fall through */ }
    return chromium.launch({ headless: true, timeout: 20000 });
  }
}

const PORTFOLIO = "http://127.0.0.1:5173";
const SHOTS = [
  { name: "portfolio-hero", url: PORTFOLIO, w: 1440, h: 900, full: false },
  { name: "portfolio-desktop", url: PORTFOLIO, w: 1440, h: 1000, full: true },
  { name: "portfolio-tablet", url: PORTFOLIO, w: 768, h: 1024, full: true },
  { name: "portfolio-mobile", url: PORTFOLIO, w: 390, h: 844, full: true },
  { name: "section-work", url: PORTFOLIO, w: 1440, h: 1100, anchor: "work" },
  { name: "section-alli", url: PORTFOLIO, w: 1440, h: 1100, anchor: "alli" },
  { name: "section-resources", url: PORTFOLIO, w: 1440, h: 1100, anchor: "resources" },
  { name: "section-journey", url: PORTFOLIO, w: 1440, h: 1100, anchor: "journey" },
  { name: "section-contact", url: PORTFOLIO, w: 1440, h: 1100, anchor: "contact" },
  { name: "interaction-hero", url: PORTFOLIO, w: 1440, h: 900, full: false, pointer: { x: 980, y: 430 } },
  { name: "interaction-work", url: PORTFOLIO, w: 1440, h: 1100, anchor: "work", pointer: { x: 700, y: 620 } },
  { name: "studio-desktop", url: "http://127.0.0.1:4174", w: 1440, h: 1000, full: true },
  { name: "studio-mobile", url: "http://127.0.0.1:4174", w: 390, h: 844, full: true },
];

const browser = await launch();
let problems = 0;
for (const shot of SHOTS) {
  const context = await browser.newContext({ viewport: { width: shot.w, height: shot.h } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  await page.goto(shot.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => undefined);
  await page.waitForTimeout(900);

  // Settle scroll entrances: a capture shows the finished design, not the
  // state of a page nobody has scrolled through yet.
  await page.evaluate(async () => {
    if (document.documentElement.scrollHeight > window.innerHeight * 2) {
      const step = Math.max(240, Math.floor(window.innerHeight * 0.5));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 70));
      }
      window.scrollTo(0, 0);
    }
    document
      .querySelectorAll(".reveal:not(.is-in)")
      .forEach((el) => el.classList.add("is-in"));
  });
  await page.waitForTimeout(400);

  if (shot.anchor) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "instant" });
    }, shot.anchor);
    await page.waitForTimeout(500);
  }

  // Engage the pointer so tilt and specular light are visible in the shot.
  if (shot.pointer) {
    await page.mouse.move(shot.pointer.x, shot.pointer.y, { steps: 14 });
    await page.waitForTimeout(700);
  }

  await page.screenshot({
    path: path.join(outDir, `${label}-${shot.name}.png`),
    fullPage: Boolean(shot.full),
    animations: "disabled",
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) { errors.push(`horizontal overflow: ${overflow}px`); problems += 1; }
  if (errors.length) { problems += 1; console.log(`${shot.name}: ${errors.slice(0, 6).join(" | ")}`); }
  await context.close();
}
await browser.close();
console.log(problems ? `${problems} issue(s) reported for ${label}` : `clean capture: ${label}`);
