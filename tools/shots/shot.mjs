// Screenshot of the built game (Playwright + SwiftShader, as podrcr's scripts/shots): serves
// packages/app/dist, waits N simulated seconds and saves PNGs. Usage:
//   node tools/shots/shot.mjs <outDir> [query] [seconds] [width] [height]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [outDir = "shots", query = "", seconds = "6", width = "1280", height = "720", cam = ""] = process.argv.slice(2);
const root = join(process.cwd(), "packages/app/dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent((req.url ?? "/").split("?")[0]) === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  try {
    // Read first: a missing file answers 404 instead of failing after the headers went out.
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    if (process.env.SHOT_VERBOSE) console.log(`404 ${req.url}`);
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => {
  logs.push(`${m.type()}: ${m.text()}`);
  if (process.env.SHOT_VERBOSE) console.log(`console ${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
page.on("crash", () => console.log("crashed; last logs:\n" + logs.slice(-15).join("\n")));
// Shots show the game, not the first-start help card.
await page.addInitScript('localStorage.setItem("broadside.help", "1")');
// SHOT_SETTINGS: graphics settings JSON stored before loading (use without `quality` in the query).
if (process.env.SHOT_SETTINGS) await page.addInitScript(`localStorage.setItem("broadside.graphics", ${JSON.stringify(process.env.SHOT_SETTINGS)})`);
// SHOT_INIT: a script run before the page's own (e.g. localStorage choices such as the steering mode).
if (process.env.SHOT_INIT) await page.addInitScript(process.env.SHOT_INIT);
// Optional scripted actions during the advance: SHOT_SCRIPT is a function body (b, t) => {...}.
if (process.env.SHOT_SCRIPT) await page.addInitScript(`globalThis.__shotScript = (b, t) => { ${process.env.SHOT_SCRIPT} }`);
await page.goto(`http://localhost:${port}/index.html?${query}`);
await page.waitForFunction(() => globalThis.__broadside !== undefined, null, { timeout: 60000 });
// Advance simulated time explicitly so the shot does not depend on SwiftShader frame rate.
// Advance in frame-sized steps and forward events to the renderer, as the game loop does.
await page.evaluate((s) => {
  const b = globalThis.__broadside;
  const steps = Math.round(Number(s) * 30);
  for (let i = 0; i < steps; i++) {
    b.session.advance(1 / 30);
    if (globalThis.__shotScript) globalThis.__shotScript(b, i / 30);
    b.renderer.onEvents(b.session.sim.drainEvents());
  }
}, seconds);
if (cam) {
  // alpha,beta,radius of the follow camera (orbit around the player's ship).
  await page.evaluate((c) => {
    const [a, b, r] = c.split(",").map(Number);
    const camera = globalThis.__broadside.renderer.camera.camera;
    camera.alpha = a;
    camera.beta = b;
    camera.radius = r;
  }, cam);
}
// Optional HUD clicks after the advance: SHOT_CLICK is a comma-separated list of data-testid values.
if (process.env.SHOT_CLICK) {
  await page.waitForTimeout(500);
  for (const id of process.env.SHOT_CLICK.split(",")) await page.locator(`[data-testid="${id}"]`).dispatchEvent("pointerdown");
}
// SHOT_WAIT: extra milliseconds before the shot (large models arrive after the first frames).
await page.waitForTimeout(3000 + Number(process.env.SHOT_WAIT ?? 0));
// Optional action right before the shot (short-lived effects): SHOT_BEFORE is a function body (b) => {...},
// followed by SHOT_BEFORE_WAIT milliseconds of frames (default 120; more for a state the frames must settle into).
if (process.env.SHOT_BEFORE) {
  await page.evaluate(new Function("((b) => { " + process.env.SHOT_BEFORE + " })(globalThis.__broadside)"));
  await page.waitForTimeout(Number(process.env.SHOT_BEFORE_WAIT ?? 120));
}
// Optional inspection view: SHOT_INSPECT = "alpha,beta,radius,height". The game's own chase camera
// (with its post-processing), aimed `height` above the centre of the player's ship and let closer
// than the game allows (the chase camera aims high and keeps 18 m off). An alpha written "@a" is
// relative to the ship's heading: "@0" looks from dead astern, "@1.57" from the port beam.
if (process.env.SHOT_INSPECT) {
  await page.evaluate((spec) => {
    const parts = spec.split(",");
    const [, beta, radius, height = 2] = parts.map(Number);
    let alpha = Number(parts[0]);
    if (parts[0].startsWith("@")) {
      // Yaw of the hull from its quaternion (rotation about +Y; roll and pitch are small).
      const q = globalThis.__broadside.session.sim.player().body.rot;
      alpha = -Math.PI / 2 - 2 * Math.atan2(q.y, q.w) + Number(parts[0].slice(1));
    }
    const follow = globalThis.__broadside.renderer.camera;
    follow.lift = height;
    Object.defineProperty(follow.camera, "lowerRadiusLimit", { get: () => 0.5, set: () => {} });
    Object.assign(follow.camera, { alpha, beta, radius });
  }, process.env.SHOT_INSPECT);
  await page.waitForTimeout(1500);
}
if (process.env.SHOT_EVAL_FIRST) console.log("eval0:", JSON.stringify(await page.evaluate(new Function("return ((b) => { " + process.env.SHOT_EVAL_FIRST + " })(globalThis.__broadside)"))));
await page.screenshot({ path: join(outDir, "scene.png"), timeout: 90000 });
const stats = await page.evaluate(() => ({ drawCalls: globalThis.__broadside.renderer.drawCalls() }));
// Optional diagnostics: SHOT_EVAL is a function body (b) => value, printed as JSON.
if (process.env.SHOT_EVAL) console.log("eval:", JSON.stringify(await page.evaluate(new Function("return ((b) => { " + process.env.SHOT_EVAL + " })(globalThis.__broadside)"))));
console.log(JSON.stringify(stats));
for (const l of logs.filter((l) => /error|warn/i.test(l)).slice(0, 20)) console.log(l);
await browser.close();
server.close();
