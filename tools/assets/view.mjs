#!/usr/bin/env node
/**
 * Asset preview (dev tool): renders a GLB from the side, from above and at three quarters in
 * headless Chromium (SwiftShader) and prints its bounding box, so a source model can be judged and
 * measured before it is cut and fitted. Babylon comes from its CDN: a tool page, not the game.
 *
 * Usage: node tools/assets/view.mjs <model.glb> <out-prefix>
 */
/* global window */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { createRequire } from "node:module";

// Playwright is installed globally in the session image (not a project dependency), as for tools/shots.
const { chromium } = createRequire(import.meta.url)("playwright");

const [model, out] = process.argv.slice(2);
const page = `<!doctype html><html><body style="margin:0"><canvas id="c" width="1200" height="600"></canvas>
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script>
const engine = new BABYLON.Engine(document.getElementById("c"), true, { preserveDrawingBuffer: true });
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.55, 0.6, 0.65, 1);
new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0.3, 1, 0.2), scene).intensity = 1.2;
const cam = new BABYLON.ArcRotateCamera("c", 0, 1.3, 10, BABYLON.Vector3.Zero(), scene);
cam.minZ = 0.01;
window.views = [];
BABYLON.SceneLoader.ImportMeshAsync("", "/", "${basename(model)}", scene).then((r) => {
  const { min, max } = r.meshes[0].getHierarchyBoundingVectors(true);
  const c = min.add(max).scale(0.5); const size = max.subtract(min);
  cam.target = c; cam.radius = Math.max(size.x, size.y, size.z) * 1.4;
  window.info = { min: min.asArray().map((v) => +v.toFixed(3)), max: max.asArray().map((v) => +v.toFixed(3)), meshes: r.meshes.length, materials: scene.materials.map((m) => m.name) };
  window.ready = true;
});
engine.runRenderLoop(() => scene.render());
window.setView = (a, b) => { cam.alpha = a; cam.beta = b; };
</script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/") return res.end(page);
  try { res.end(readFileSync(dirname(model) + "/" + decodeURIComponent(req.url.slice(1)))); } catch { res.statusCode = 404; res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await browser.newPage({ viewport: { width: 1200, height: 600 } });
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.ready, null, { timeout: 240000 });
console.log(JSON.stringify(await p.evaluate(() => window.info)));
for (const [name, a, b] of [["side", 0, Math.PI / 2], ["top", 0, 0.01], ["three", 0.8, 1.15]]) {
  await p.evaluate(([a, b]) => window.setView(a, b), [a, b]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}-${name}.png`, timeout: 120000 });
}
await browser.close();
server.close();
