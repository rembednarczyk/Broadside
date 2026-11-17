#!/usr/bin/env node
/**
 * Sky test bench: renders the game's sky shader alone (the real GLSL from
 * packages/engine/src/shaders) on a full-screen triangle in headless Chromium, with a simple tone
 * map and sepia like the game's grade, in a few seconds. For tuning the clouds against the
 * reference frames without rendering the whole game.
 *
 * Usage: node tools/sky/sky-test.mjs <out.png> [octaves=5] [cover=0.5] [sunElevationDeg=24] [yawDeg=0] [pitchDeg=14] [time=0]
 *   yaw 0 looks towards the sun's bearing.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const [out, octaves = "5", cover = "0.5", sunEl = "24", yaw = "0", pitch = "14", time = "0"] = process.argv.slice(2);
const dir = join(fileURLToPath(new URL(".", import.meta.url)), "../../packages/engine/src/shaders");
// The shaders are TypeScript template strings: strip the few type annotations and evaluate.
const js = (file) => readFileSync(join(dir, file), "utf8").replace(/^import .*$/m, "").replace(/export const/g, "const").replace(/\((\w+): number\): string/g, "($1)");
const { skyFragment } = new Function(`${js("sky-clouds.ts")}\n${js("sky.ts")}\nreturn { skyFragment };`)();
const frag = skyFragment(Number(octaves));
const at = frag.lastIndexOf("void main() {");
const shader = `${frag.slice(0, at)}void skyMain() {${frag.slice(at + "void main() {".length)}
void main() {
  skyMain();
  vec3 c = gl_FragColor.rgb * 1.0;
  c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  l = clamp((l - 0.5) * 1.35 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(mix(c, l * vec3(1.0, 0.9, 0.72), 0.85), 1.0);
}`;
const rad = Math.PI / 180;
const el = Number(sunEl) * rad;
const page = `<canvas id="c" width="800" height="450"></canvas><script>
const gl = document.getElementById("c").getContext("webgl", { preserveDrawingBuffer: true });
const vs = \`attribute vec2 p; uniform vec3 fwd, right, up; varying vec3 vDir; void main(){ vDir = fwd + right * p.x * 0.82 + up * p.y * 0.46; gl_Position = vec4(p, 0.0, 1.0); }\`;
const fs = ${JSON.stringify(shader)};
const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) window.err = gl.getShaderInfoLog(o); return o; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const u = (n) => gl.getUniformLocation(pr, n);
const yaw = ${Number(yaw) * rad}, pitch = ${Number(pitch) * rad};
const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
const up = [f[1]*r[2]-f[2]*r[1], f[2]*r[0]-f[0]*r[2], f[0]*r[1]-f[1]*r[0]];
gl.uniform3fv(u("fwd"), f); gl.uniform3fv(u("right"), r); gl.uniform3fv(u("up"), up);
gl.uniform3f(u("sunDirection"), 0, ${Math.sin(el)}, ${Math.cos(el)});
gl.uniform3f(u("sunColor"), 1.0, 0.88, 0.68);
const k = ${Number(cover)};
gl.uniform3f(u("skyZenith"), 0.16 + 0.1 * k, 0.33 - 0.03 * k, 0.62 - 0.3 * k);
gl.uniform3f(u("skyHorizon"), 0.66 - 0.2 * k, 0.72 - 0.25 * k, 0.8 - 0.32 * k);
gl.uniform1f(u("cloudCover"), k); gl.uniform1f(u("time"), ${Number(time)}); gl.uniform2f(u("windOffset"), ${Number(time)} * 8.0, ${Number(time)} * 3.0);
gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); window.done = true;
</script>`;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await browser.newPage({ viewport: { width: 800, height: 450 } });
await p.setContent(page);
await p.waitForFunction(() => globalThis.done, null, { timeout: 120000 });
const err = await p.evaluate(() => globalThis.err);
if (err) console.log("shader error:", err);
await p.locator("#c").screenshot({ path: out });
await browser.close();
console.log(out);
