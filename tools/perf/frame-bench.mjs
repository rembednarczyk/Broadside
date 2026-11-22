/* global performance, URL */
/**
 * Frame cost bench: loads the built game (packages/app/dist) in headless Chromium, plays a few
 * seconds of a seed, then times `scene.render()` with each part of the frame switched off in
 * turn (sky, ocean, ships, shadows, post-processing), so the cost of each is the difference from
 * the full frame. SwiftShader renders on the CPU: the milliseconds are not a phone's, the shares
 * are (pixel-bound passes scale with pixels on both). Each sample ends with a 1-pixel read so the
 * GPU work is inside the timing.
 *
 * Usage: pnpm build && node tools/perf/frame-bench.mjs [query] [width=800] [height=450] [frames=6]
 *   e.g. "quality=ultra&weather=fresh&hours=17:00&camera=chase". Prints a table and JSON.
 *   BENCH_SETTINGS='{"preset":"custom",...}': graphics settings to store before loading (omit `quality`).
 *   BENCH_PARTS=ocean,shallows: time only these rows (a quick check of one change); ship rows as `ship:*`.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// Playwright is installed globally in the image (NODE_PATH), as for tools/shots.
const { chromium } = createRequire(import.meta.url)("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "../../packages/app/dist");
const [query = "quality=high&weather=fresh&hours=17:00", width = "800", height = "450", frames = "6"] = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".bin": "application/octet-stream", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const path = join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!existsSync(path) || !extname(path)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
await page.addInitScript('localStorage.setItem("broadside.help", "1")');
// BENCH_SETTINGS: full graphics settings as JSON (as the game stores them), for a query without `quality`.
if (process.env.BENCH_SETTINGS) await page.addInitScript(`localStorage.setItem("broadside.graphics", ${JSON.stringify(process.env.BENCH_SETTINGS)})`);
await page.goto(`http://localhost:${port}/index.html?seed=7&hud=0&clock=stop&${query}`);
await page.waitForFunction(() => globalThis.__broadside !== undefined, null, { timeout: 60000 });
await page.evaluate(() => { const b = globalThis.__broadside; for (let i = 0; i < 90; i++) b.session.advance(1 / 30); });
// Models and textures arrive after the first frames.
await page.waitForTimeout(20000);
const only = process.env.BENCH_PARTS ? process.env.BENCH_PARTS.split(",") : null;
const result = await page.evaluate(([n, only]) => {
  const wanted = (name) => !only || only.includes(name) || (name.startsWith("ship:") && only.includes("ship:*"));
  const b = globalThis.__broadside;
  const r = b.renderer;
  const scene = r.scene;
  const gl = r.engine._gl;
  const px = new Uint8Array(4);
  scene.render();
  // Switching a part recompiles shaders on the next frames: those are rendered, not timed.
  // The median by default; the mean where frames alternate in cost (the sky redrawn every other frame).
  const time = (mean = false) => {
    for (let i = 0; i < 3; i++) {
      scene.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    const t = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      scene.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      t.push(performance.now() - t0);
    }
    t.sort((a, c) => a - c);
    return mean ? t.reduce((a, c) => a + c, 0) / t.length : t[t.length >> 1];
  };
  const ships = [...r.views.values()].map((v) => v.root);
  const parts = {
    // The dome, or its half-resolution backdrop (render target and layer) where the preset uses one.
    sky: (on) => {
      const backdrop = scene.customRenderTargets.find((t) => t.name === "sky-backdrop");
      if (backdrop) {
        backdrop.refreshRate = on ? 1 : 0;
        for (const l of scene.layers) if (l.name === "sky-backdrop") l.isEnabled = on;
      } else r.sky.mesh.isVisible = on;
    },
    ocean: (on) => { r.ocean.mesh.isVisible = on; },
    // The shallows and surf term of the ocean (no islands: the loop and the surf's lace and noise still run).
    shallows: (on) => {
      r.ocean.material.setInt("islandCount", on ? (r.ocean.islandCount ?? 0) : 0);
    },
    ships: (on) => { for (const s of ships) s.setEnabled(on); },
    shadows: (on) => { scene.shadowsEnabled = on; },
    post: (on) => { scene.postProcessesEnabled = on; },
    // The post-processes one by one (default pipeline's bloom, SSAO, motion blur, the grade with the sun shafts).
    "post:bloom": (on) => { const p = scene.postProcessRenderPipelineManager.supportedPipelines.find((x) => x.name === "post"); if (p) p.bloomEnabled = on; },
    "post:ssao": (on) => { const m = scene.postProcessRenderPipelineManager; for (const c of scene.cameras) { if (on) m.attachCamerasToRenderPipeline("ssao", c); else m.detachCamerasFromRenderPipeline("ssao", c); } },
    "post:motion": (on) => { for (const pp of scene.postProcesses) if (pp.name === "motion") pp.enabled = on; },
    "post:grade": (on) => { for (const pp of scene.postProcesses) if (pp.name === "grade") pp.enabled = on; },
  };
  // The game redraws the sky backdrop every other frame while the view holds still (Sky.refresh);
  // timed here at every frame, as a turning view does, and the saving of the half rate apart.
  const backdrop = scene.customRenderTargets.find((t) => t.name === "sky-backdrop");
  if (backdrop) backdrop.refreshRate = 1;
  const out = { full: time() };
  if (backdrop && wanted("sky:half-rate saves")) {
    const every = time(true);
    backdrop.refreshRate = 2;
    out["sky:half-rate saves"] = every - time(true);
    backdrop.refreshRate = 1;
  }
  // Switching the whole post-processing off and on leaves the frame cheaper than before (the
  // pipelines rebuild their targets lazily): each row after it is timed against a frame taken
  // just then, not against the first one, or it reads as a bogus saving.
  let base = out.full;
  for (const [name, set] of Object.entries(parts)) {
    if (!wanted(name)) continue;
    if (name.includes(":")) base = time();
    set(false);
    out[name] = base - time();
    set(true);
  }
  // The ships by kind of part: their meshes grouped by the first word of the material's name.
  const groups = new Map();
  for (const root of ships) for (const m of root.getChildMeshes(false)) {
    if (!m.isVisible || !m.material) continue;
    const key = "ship:" + m.material.name.split(/[-_ ]/)[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const [key, meshes] of groups) {
    if (!wanted(key)) continue;
    base = time();
    for (const m of meshes) m.isVisible = false;
    out[key] = base - time();
    for (const m of meshes) m.isVisible = true;
  }
  return { ...out, drawCalls: r.drawCalls(), pixels: scene.getEngine().getRenderWidth() * scene.getEngine().getRenderHeight() };
}, [Number(frames), only]);
await browser.close();
server.close();
console.log(`frame ${result.full.toFixed(0)} ms at ${result.pixels} px, ${result.drawCalls} draw calls`);
for (const k of Object.keys(result).filter((k) => !["full", "drawCalls", "pixels"].includes(k))) console.log(`  ${k.padEnd(16)} ${result[k].toFixed(0).padStart(6)} ms  ${((100 * result[k]) / result.full).toFixed(0).padStart(3)}%`);
console.log(JSON.stringify(result));
