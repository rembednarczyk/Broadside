/* global document, getComputedStyle -- the page.evaluate callbacks run in the browser */
// Audit of the HUD layout (as podrcr's ui-audit): the built game (packages/app/dist) opened at
// screen sizes from small phones in landscape to large monitors, with simple and classic
// steering, in English and in Polish (the longer words); for each, the boxes of the HUD's regions are measured and every overlap between
// two of them, every box outside the screen, every column that has to scroll and every type
// smaller than MIN_FONT is reported, with a screenshot. Exit code 1 if anything is reported.
// Usage: node tools/ui/ui-audit.mjs <outDir> [WxH ...]   (Playwright + SwiftShader, low preset)
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import process from "node:process";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [outDir = "ui-audit", ...sizesArg] = process.argv.slice(2);
/** CSS pixels: phones in landscape (SE, 360-wide Androids, iPhone 12-15, large Androids), tablets, laptops, monitors. */
const SIZES = sizesArg.length ? sizesArg : ["568x320", "640x360", "740x360", "800x360", "844x390", "915x412", "932x430", "1024x600", "1024x768", "1180x820", "1280x720", "1366x768", "1440x900", "1920x1080", "2560x1440"];
/** Smallest type the HUD may use, in CSS pixels. */
const MIN_FONT = 8;
const root = join(process.cwd(), "packages/app/dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff" };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const path = join(root, url === "/" ? "index.html" : url);
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

/** The regions measured: name and selector (several boxes may match one selector). */
const REGIONS = [
  ["sailing", ".sailing"],
  ["job", ".job"],
  ["compass", ".compass"],
  ["target", ".target"],
  ["combat", ".combat"],
  ["fire-port", ".fire.port"],
  ["fire-starboard", ".fire.starboard"],
  ["helm", ".helm-pad"],
  ["corner", ".corner"],
  ["harbour", ".harbour"],
];

const report = [];
let problems = 0;
for (const size of SIZES) {
  const [w, h] = size.split("x").map(Number);
  for (const [steering, lang] of [["simple", "en"], ["classic", "pl"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.addInitScript(`localStorage.setItem("broadside.help", "1"); localStorage.setItem("broadside.steering", "${steering}");`);
    await page.goto(`http://localhost:${port}/index.html?seed=7&quality=low&hours=12:00&clock=stop`);
    await page.waitForFunction(() => globalThis.__broadside !== undefined, null, { timeout: 90000 });
    await page.waitForSelector(".combat", { timeout: 60000 });
    if (lang === "pl") {
      await page.click('[data-testid="open-settings"]');
      await page.click('text=Polski');
      await page.click('[data-testid="open-settings"]');
    }
    await page.evaluate(() => document.fonts.ready);
    const found = await page.evaluate((regions) => {
      const boxes = [];
      for (const [name, sel] of regions) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) boxes.push({ name, x: r.left, y: r.top, w: r.width, h: r.height });
        }
      }
      const scrolls = [...document.querySelectorAll(".col")].filter((c) => c.scrollHeight > c.clientHeight + 1).map((c) => c.className);
      const fonts = [...document.querySelectorAll(".hud button, .hud .row, .hud .title, .hud small")].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { boxes, scrolls, minFont: Math.min(...fonts), u: getComputedStyle(document.documentElement).getPropertyValue("--u") };
    }, REGIONS);
    const issues = [];
    const { boxes } = found;
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      if (a.x < -0.5 || a.y < -0.5 || a.x + a.w > w + 0.5 || a.y + a.h > h + 0.5) issues.push(`${a.name} poza ekranem`);
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 1 && oy > 1) issues.push(`${a.name} nachodzi na ${b.name} (${ox.toFixed(0)}x${oy.toFixed(0)} px)`);
      }
    }
    for (const s of found.scrolls) issues.push(`kolumna przewija się (${s})`);
    if (found.minFont < MIN_FONT) issues.push(`najmniejsze pismo ${found.minFont.toFixed(1)} px`);
    // The settings window must fit the screen (it scrolls inside if it must, but never off it).
    await page.click('[data-testid="open-settings"]');
    const modal = await page.evaluate(() => {
      const r = document.querySelector(".settings").getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    if (modal.x < 0 || modal.y < 0 || modal.x + modal.w > w || modal.y + modal.h > h) issues.push("ustawienia poza ekranem");
    if (size === SIZES[0] || size === "640x360") await page.screenshot({ path: join(outDir, `${size}-${lang}-settings.png`), timeout: 120000 });
    await page.click('[data-testid="open-settings"]');
    problems += issues.length;
    const name = `${size}-${steering}-${lang}`;
    await page.screenshot({ path: join(outDir, `${name}.png`), timeout: 120000 });
    report.push(`${name.padEnd(20)} --u ${String(found.u).trim().padEnd(10)} pismo od ${found.minFont.toFixed(1)} px  ${issues.length ? issues.join("; ") : "OK"}`);
    console.log(report[report.length - 1]);
    await page.close();
  }
}
await writeFile(join(outDir, "report.txt"), report.join("\n") + "\n");
await browser.close();
server.close();
process.exit(problems ? 1 : 0);
