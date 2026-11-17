#!/usr/bin/env node
/**
 * Sky test bench: renders the game's sky shader alone (the real GLSL from
 * packages/engine/src/shaders) on a full-screen triangle in headless Chromium, with a simple tone
 * map and sepia like the game's grade, in a few seconds. For tuning the clouds against the
 * reference frames without rendering the whole game.
 *
 * Usage: node tools/sky/sky-test.mjs <out.png> [octaves=5] [cover=0.5] [sunElevationDeg=24] [yawDeg=0] [pitchDeg=14] [time=0]
 *   yaw 0 looks towards the sun's bearing. Octaves 6: the clouds of the top presets, read from the
 *   noise volume of cloud-noise.ts (Node strips the types of that file on import).
 */
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const [out, octaves = "5", cover = "0.5", sunEl = "24", yaw = "0", pitch = "14", time = "0"] = process.argv.slice(2);
const dir = join(fileURLToPath(new URL(".", import.meta.url)), "../../packages/engine/src/shaders");
// The shaders are TypeScript template strings: Node strips the types, then they are evaluated.
const js = (file) => stripTypeScriptTypes(readFileSync(join(dir, file), "utf8")).replace(/^import .*$/m, "").replace(/export const/g, "const");
const { skyFragment } = new Function(`${js("sky-clouds.ts")}\n${js("sky.ts")}\nreturn { skyFragment };`)();
const volume = Number(octaves) >= 6;
const frag = skyFragment(Number(octaves), volume);
const noise = volume ? Buffer.from((await import(join(dir, "cloud-noise.ts"))).cloudNoiseVolume(64)).toString("base64") : "";
const at = frag.lastIndexOf("void main() {");
const shader = `#version 300 es\n${frag.slice(0, at).replace("varying vec3 vDir;", "in vec3 vDir;\nout vec4 fragColor;")}void skyMain() {${frag.slice(at + "void main() {".length)}
void main() {
  skyMain();
  vec3 c = gl_FragColor.rgb * 1.0;
  c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  l = clamp((l - 0.5) * 1.35 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(mix(c, l * vec3(1.0, 0.9, 0.72), 0.85), 1.0);
}`.replaceAll("gl_FragColor", "fragColor");
const rad = Math.PI / 180;
const el = Number(sunEl) * rad;
const page = `<canvas id="c" width="800" height="450"></canvas><script>
const gl = document.getElementById("c").getContext("webgl2", { preserveDrawingBuffer: true });
const vs = \`#version 300 es\nin vec2 p; uniform vec3 fwd, right, up; out vec3 vDir; void main(){ vDir = fwd + right * p.x * 0.82 + up * p.y * 0.46; gl_Position = vec4(p, 0.0, 1.0); }\`;
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
const noise = ${JSON.stringify(noise)};
if (noise) {
  const bytes = Uint8Array.from(atob(noise), (ch) => ch.charCodeAt(0));
  gl.bindTexture(gl.TEXTURE_3D, gl.createTexture());
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, 64, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(u("cloudNoise"), 0);
}
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
