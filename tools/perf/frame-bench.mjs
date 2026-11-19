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
const result = await page.evaluate((n) => {
  const b = globalThis.__broadside;
  const r = b.renderer;
  const scene = r.scene;
  const gl = r.engine._gl;
  const px = new Uint8Array(4);
  scene.render();
  // Switching a part recompiles shaders on the next frames: those are rendered, not timed.
  const time = () => {
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
    return t[t.length >> 1];
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
    "post:ssao": (on) => { const m = scene.postProcessRenderPipelineManager; for (const c of scene.cameras) on ? m.attachCamerasToRenderPipeline("ssao", c) : m.detachCamerasFromRenderPipeline("ssao", c); },
    "post:motion": (on) => { for (const pp of scene.postProcesses) if (pp.name === "motion") pp.enabled = on; },
    "post:grade": (on) => { for (const pp of scene.postProcesses) if (pp.name === "grade") pp.enabled = on; },
  };
  const out = { full: time() };
  for (const [name, set] of Object.entries(parts)) {
    set(false);
    out[name] = out.full - time();
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
    for (const m of meshes) m.isVisible = false;
    out[key] = out.full - time();
    for (const m of meshes) m.isVisible = true;
  }
  return { ...out, drawCalls: r.drawCalls(), pixels: scene.getEngine().getRenderWidth() * scene.getEngine().getRenderHeight() };
}, Number(frames));
await browser.close();
server.close();
console.log(`frame ${result.full.toFixed(0)} ms at ${result.pixels} px, ${result.drawCalls} draw calls`);
for (const k of Object.keys(result).filter((k) => !["full", "drawCalls", "pixels"].includes(k))) console.log(`  ${k.padEnd(16)} ${result[k].toFixed(0).padStart(6)} ms  ${((100 * result[k]) / result.full).toFixed(0).padStart(3)}%`);
console.log(JSON.stringify(result));
