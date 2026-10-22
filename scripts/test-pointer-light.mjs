/**
 * Live pointer-light / 3D interaction proof against the running portfolio.
 *
 * Requires the real launcher services (portfolio on 5173):
 *   node tools/local-dev.mjs start --no-open
 *   node scripts/test-pointer-light.mjs   (cmd.exe on Windows; needs localhost access)
 *
 * Verifies the liquid-glass interaction layer: usePointerLight writes --lx/--ly
 * on hover, featured cards tilt in 3D, the light fades on pointer leave, and
 * prefers-reduced-motion disables the whole layer.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("playwright is not installed (run npm install on Windows node first)");
  process.exit(1);
}

const URL = process.env.ASTRA_PORTFOLIO_URL || "http://127.0.0.1:5173";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const litOf = (page, selector) =>
  page.$eval(selector, (el) => {
    const s = getComputedStyle(el);
    return { lit: parseFloat(s.getPropertyValue("--lit")) || 0, lx: s.getPropertyValue("--lx").trim(), ly: s.getPropertyValue("--ly").trim() };
  });

async function scrollIntoView(page, selector) {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(350);
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  if (box.y < 60 || box.y + box.height > 870) throw new Error(`${selector} not in viewport (y=${Math.round(box.y)}, h=${Math.round(box.height)})`);
  return box;
}

async function hoverBox(page, box) {
  const x = box.x + box.width / 2;
  const y = Math.min(Math.max(box.y + box.height / 2, 90), 850);
  await page.mouse.move(x, y);
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.move(x + 5 + i * 3, y + 4 + i * 2);
    await page.waitForTimeout(140);
  }
}

try {
  const probe = await fetch(URL, { signal: AbortSignal.timeout(4000) });
  if (!probe.ok) throw new Error(`portfolio answered ${probe.status}`);
} catch (error) {
  console.error(`Portfolio is not reachable on ${URL} (${error.cause?.code || error.message}).`);
  console.error("Start the launcher first: node tools/local-dev.mjs start --no-open");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".hero", { timeout: 20000 });
  await page.waitForTimeout(800);

  const heroBox = await page.locator(".hero").boundingBox();
  await hoverBox(page, { ...heroBox, width: 400, x: 500, y: 100 });
  const hero = await litOf(page, ".hero");
  check("hero pointer light turns on", hero.lit > 0.2, `lit=${hero.lit.toFixed(3)} lx=${hero.lx} ly=${hero.ly}`);

  const navBox = await page.locator("header.nav").boundingBox();
  await hoverBox(page, navBox);
  const nav = await litOf(page, "header.nav");
  check("nav pointer light turns on", nav.lit > 0.2, `lit=${nav.lit.toFixed(3)}`);

  const cardBox = await scrollIntoView(page, ".project-card.project-featured");
  await hoverBox(page, cardBox);
  const transform = await page.$eval(".project-card.project-featured", (el) => getComputedStyle(el).transform);
  check("featured project card tilts in 3D", transform.includes("matrix3d"), transform.slice(0, 55));

  const stageBox = await scrollIntoView(page, ".system-stage");
  await hoverBox(page, stageBox);
  const stage = await litOf(page, ".system-stage");
  check("ALLI stage pointer specular turns on", stage.lit > 0.2, `lit=${stage.lit.toFixed(3)} lx=${stage.lx}`);

  const formBox = await scrollIntoView(page, ".contact-form");
  await hoverBox(page, formBox);
  const form = await litOf(page, ".contact-form");
  check("contact form pointer light turns on", form.lit > 0.2, `lit=${form.lit.toFixed(3)}`);

  const featuredResource = await page.$(".resource-featured");
  if (featuredResource) {
    const hubBox = await scrollIntoView(page, ".resource-featured");
    await hoverBox(page, hubBox);
    const hub = await litOf(page, ".resource-featured");
    check("featured resource card pointer light turns on", hub.lit > 0.2, `lit=${hub.lit.toFixed(3)}`);
  } else {
    check("featured resource card pointer light turns on", true, "conditional surface not rendered — no published featured resource right now");
  }

  await page.mouse.move(10, 10);
  await page.waitForTimeout(1000);
  const dimmed = await litOf(page, ".contact-form");
  check("pointer light fades when pointer leaves", dimmed.lit < 0.15, `lit=${dimmed.lit.toFixed(3)}`);

  check("no page errors in pointer pass", pageErrors.length === 0, pageErrors.join("; "));
  await context.close();

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rpage = await reduced.newPage();
  await rpage.goto(URL, { waitUntil: "domcontentloaded" });
  await rpage.waitForSelector(".hero", { timeout: 20000 });
  await rpage.mouse.move(700, 460);
  await rpage.waitForTimeout(500);
  const rhero = await litOf(rpage, ".hero");
  check("reduced motion disables pointer light", rhero.lit === 0, `lit=${rhero.lit.toFixed(3)}`);
  await reduced.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pointer-light checks passed`);
process.exit(failed.length ? 1 : 0);
