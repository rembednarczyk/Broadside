#!/usr/bin/env node
/**
 * Profile of a turned object (a gun barrel) from a scan lying at any angle (scripted): bakes the
 * transforms, finds the long axis by principal component analysis (power iteration on the
 * covariance of the vertices), turns it along +Z, and measures the radius in slices along the axis
 * (a least-squares circle per slice, refitted without the points off it, so mounts, handles and
 * scan noise do not count). The game lathes the profile into a clean surface of revolution: a scan's shell is full of
 * open borders and UV islands that no simplifier brings to a prop's budget without tearing it.
 *
 * Usage: node tools/assets/lathe-profile.mjs <in.glb> <out.json> [slices=40] [flipZ=0] [from=0] [to=1]
 *   from, to: shares of the length to keep (cuts a tiller behind the cascabel).
 * Output: { "profile": [[z, r], ...] } with z 0 (breech) .. 1 (muzzle), r in shares of the length.
 */
import process from "node:process";
import { writeFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { flatten, weld } from "@gltf-transform/functions";
import { bake, eachPrim, principalAxes } from "./lib.mjs";

const [input, output, slices = "40", flipZ = "0", from = "0", to = "1"] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
await doc.transform(flatten());
bake(doc);
await doc.transform(weld());

const { mean, axes } = principalAxes(doc);
let w = axes[0];
if (flipZ === "1") w = w.map((x) => -x);
const dotY = w[1];
let u = [-dotY * w[0], 1 - dotY * w[1], -dotY * w[2]];
const ul = Math.hypot(...u);
u = u.map((x) => x / ul);
const r = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
const turn = (x, y, z) => [x * r[0] + y * r[1] + z * r[2], x * u[0] + y * u[1] + z * u[2], x * w[0] + y * w[1] + z * w[2]];

// Turn, then find the axis line (median across) and the length.
const pts = [];
let zMin = Infinity;
let zMax = -Infinity;
eachPrim(doc, (p) => {
  const pos = p.getAttribute("POSITION");
  const a = pos.getArray();
  for (let i = 0; i < a.length; i += 3) {
    const v = turn(a[i] - mean[0], a[i + 1] - mean[1], a[i + 2] - mean[2]);
    a.set(v, i);
    pts.push(v);
    zMin = Math.min(zMin, v[2]);
    zMax = Math.max(zMax, v[2]);
  }
  pos.setArray(a);
});
const z0 = zMin + (zMax - zMin) * Number(from);
const z1 = zMin + (zMax - zMin) * Number(to);
const len = z1 - z0;
const n2 = Number(slices);
const bins = Array.from({ length: n2 }, () => []);
for (const v of pts) {
  const k = Math.floor(((v[2] - z0) / len) * n2);
  if (k >= 0 && k < n2) bins[k].push(v);
}
/** Least-squares circle through points in the plane (Kasa's algebraic fit): [cx, cy, r]. */
const fitCircle = (b) => {
  // Solve [x y 1] [A B C]^T = -(x^2 + y^2) by the normal equations (3x3, Cramer's rule).
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  for (const [x, y] of b) {
    const q = -(x * x + y * y);
    sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; sxz += x * q; syz += y * q; sz += q;
  }
  const n3 = b.length;
  const det = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const d = det([sxx, sxy, sx, sxy, syy, sy, sx, sy, n3]);
  const A = det([sxz, sxy, sx, syz, syy, sy, sz, sy, n3]) / d;
  const B = det([sxx, sxz, sx, sxy, syz, sy, sx, sz, n3]) / d;
  const C = det([sxx, sxy, sxz, sxy, syy, syz, sx, sy, sz]) / d;
  return [-A / 2, -B / 2, Math.sqrt(Math.max(0, (A * A + B * B) / 4 - C))];
};
const profile = [];
bins.forEach((b, k) => {
  if (b.length < 12) return;
  // Fit, drop what lies off the circle (mount, handle, noise), fit again.
  let [cx, cy, r] = fitCircle(b);
  for (let pass = 0; pass < 3; pass++) {
    const near = b.filter((v) => Math.abs(Math.hypot(v[0] - cx, v[1] - cy) - r) < r * 0.25);
    if (near.length < 12) break;
    [cx, cy, r] = fitCircle(near);
  }
  profile.push([Number(((k + 0.5) / n2).toFixed(4)), Number((r / len).toFixed(4))]);
});
writeFileSync(output, `${JSON.stringify({ profile })}\n`);
console.log(`${input.split("/").pop()}: ${pts.length} vertices, ${profile.length} slices, length ${len.toFixed(3)} model units`);
console.log(profile.map((p) => p[1]).join(" "));
