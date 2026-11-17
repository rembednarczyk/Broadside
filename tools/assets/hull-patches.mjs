#!/usr/bin/env node
/**
 * Texture patches baked from a cut hull model (scripted), so parts the game builds itself (the
 * sterncastle) wear the model's own planking. An orthographic bake (rasterising the model's
 * triangles with a depth buffer and sampling its colour texture) of the ship's side amidships seen
 * from abeam: a band of plain planking under the ports. (A bake of the deck from above was tried
 * and dropped: the models' decks are cluttered and came out smeared.)
 * Writes <class>-planks.jpg beside the model and its size (model units) into <class>.json as "patches".
 *
 * Usage: node tools/assets/hull-patches.mjs <hulls-raw-dir> <out-dir> [class]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import process from "node:process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const [rawDir, outDir, only] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const W = 512;
const H = 256;

/**
 * Bakes one patch: `project(p)` maps a model point to [u 0..1, v 0..1, depth] (greater depth wins),
 * `faces(n)` says whether a triangle with unit normal n looks at the camera.
 */
const bake = (prims, project, faces) => {
  const rgb = Buffer.alloc(W * H * 3);
  const depth = new Float32Array(W * H).fill(-Infinity);
  for (const pr of prims) {
    const { pos, uv, idx, tex } = pr;
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      const P = [a, b, c].map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
      const e1 = P[1].map((v, k) => v - P[0][k]);
      const e2 = P[2].map((v, k) => v - P[0][k]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const nl = Math.hypot(...n) || 1;
      if (!faces(n.map((v) => v / nl))) continue;
      const S = P.map(project);
      const xs = S.map((s) => s[0] * W);
      const ys = S.map((s) => (1 - s[1]) * H);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys)));
      const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
      if (x0 > x1 || y0 > y1) continue;
      const area = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]);
      if (Math.abs(area) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const w1 = ((x + 0.5 - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (y + 0.5 - ys[0])) / area;
          const w2 = ((xs[1] - xs[0]) * (y + 0.5 - ys[0]) - (x + 0.5 - xs[0]) * (ys[1] - ys[0])) / area;
          const w0 = 1 - w1 - w2;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const d = w0 * S[0][2] + w1 * S[1][2] + w2 * S[2][2];
          if (d <= depth[y * W + x]) continue;
          depth[y * W + x] = d;
          const tu = w0 * uv[a * 2] + w1 * uv[b * 2] + w2 * uv[c * 2];
          const tv = w0 * uv[a * 2 + 1] + w1 * uv[b * 2 + 1] + w2 * uv[c * 2 + 1];
          const sx = Math.min(tex.width - 1, Math.max(0, Math.floor((tu - Math.floor(tu)) * tex.width)));
          const sy = Math.min(tex.height - 1, Math.max(0, Math.floor((tv - Math.floor(tv)) * tex.height)));
          rgb.set(tex.data.subarray((sy * tex.width + sx) * 3, (sy * tex.width + sx) * 3 + 3), (y * W + x) * 3);
        }
      }
    }
  }
  // Pixels nothing covered take the average colour, so the patch has no black holes.
  let sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < W * H; i++) if (depth[i] > -Infinity) {
    for (let k = 0; k < 3; k++) sum[k] += rgb[i * 3 + k];
    count++;
  }
  const mean = sum.map((v) => Math.round(v / Math.max(1, count)));
  for (let i = 0; i < W * H; i++) if (depth[i] === -Infinity) rgb.set(mean, i * 3);
  return { rgb, covered: count / (W * H) };
};

for (const file of readdirSync(rawDir).filter((f) => f.endsWith(".glb") && (!only || f === `${only}.glb`))) {
  const cls = file.replace(".glb", "");
  const doc = await io.read(join(rawDir, file));
  const textures = new Map();
  const prims = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      const t = p.getMaterial()?.getBaseColorTexture();
      const uv = p.getAttribute("TEXCOORD_0");
      if (!t || !uv) continue;
      if (!textures.has(t)) {
        const { data, info } = await sharp(t.getImage()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        textures.set(t, { data, width: info.width, height: info.height });
      }
      prims.push({ pos: p.getAttribute("POSITION").getArray(), uv: uv.getArray(), idx: p.getIndices().getArray(), tex: textures.get(t) });
    }
  }
  const metricsPath = join(outDir, `${cls}.json`);
  const m = JSON.parse(readFileSync(metricsPath, "utf8"));
  // Side: a stretch amidships, the band of planking between a third and two thirds of the gunwale's height.
  const side = { z0: -m.length * 0.11, z1: m.length * 0.11, y0: m.gunwale * 0.3, y1: m.gunwale * 0.54 };
  const planks = bake(prims, (p) => [(p[2] - side.z0) / (side.z1 - side.z0), (p[1] - side.y0) / (side.y1 - side.y0), p[0]], (n) => n[0] > 0.45);
  await sharp(planks.rgb, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toFile(join(outDir, `${cls}-planks.jpg`));
  m.patches = { planks: { w: +(side.z1 - side.z0).toFixed(3), h: +(side.y1 - side.y0).toFixed(3) } };
  writeFileSync(metricsPath, `${JSON.stringify(m)}\n`);
  console.log(`${cls}: planks covered ${(planks.covered * 100).toFixed(0)}%`);
}
