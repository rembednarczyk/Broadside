#!/usr/bin/env node
/**
 * Upright prop (a wreck, a gun) from a site scan lying at any angle (scripted): bakes the transforms, turns the scan
 * to its principal axes (PCA: the keel line along +Z, the flattest direction up), cuts away the
 * ground the scan stands on (everything below a share of the height), sets the lowest point at
 * y = 0 and scales the length to 1. Textures and UVs are kept; the game scales and places it.
 *
 * Usage: node tools/assets/upright.mjs <in.glb> <out.glb> [flipY=0] [cut=0] [centre=0] [triangles=0]
 *   cut: share of the height removed from below (the floor of the scan).
 *   triangles: budget to simplify to (0: keep the mesh). Uses meshoptimizer's permissive mode, which
 *     collapses edges across the UV seams of a scan's texture atlas (each vertex keeps its own UV).
 *   centre: 1 puts the origin at the middle of the height too (a gun barrel, not a thing that stands).
 */
import process from "node:process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { compactPrimitive, flatten, prune, quantize, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { bake, eachPrim, principalAxes } from "./lib.mjs";

const [input, output, flipY = "0", cut = "0", centre = "0", triangles = "0"] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
await doc.transform(flatten());
bake(doc);
await doc.transform(weld());
const { mean, axes } = principalAxes(doc);
const w = axes[0];
const u = axes[2].map((x) => x * (flipY === "1" ? -1 : 1));
// Right-handed frame: x = up x forward.
const r = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
const turn = (x, y, z) => [x * r[0] + y * r[1] + z * r[2], x * u[0] + y * u[1] + z * u[2], x * w[0] + y * w[1] + z * w[2]];
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
eachPrim(doc, (p) => {
  for (const [name, centred] of [["POSITION", true], ["NORMAL", false]]) {
    const attr = p.getAttribute(name);
    if (!attr) continue;
    const a = attr.getArray();
    for (let i = 0; i < a.length; i += 3) {
      const v = centred ? turn(a[i] - mean[0], a[i + 1] - mean[1], a[i + 2] - mean[2]) : turn(a[i], a[i + 1], a[i + 2]);
      a.set(v, i);
      if (centred) for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
    attr.setArray(a);
  }
});
await MeshoptSimplifier.ready;
const budget = Number(triangles);
let all = 0;
eachPrim(doc, (p) => (all += p.getIndices().getCount()));
const share = (n) => n / all;
const floor = min[1] + (max[1] - min[1]) * Number(cut);
const kMin = [Infinity, Infinity, Infinity];
const kMax = [-Infinity, -Infinity, -Infinity];
let tris = 0;
eachPrim(doc, (p) => {
  const a = p.getAttribute("POSITION").getArray();
  const idx = p.getIndices().getArray();
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    if ([idx[t], idx[t + 1], idx[t + 2]].some((i) => a[i * 3 + 1] < floor)) continue;
    keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  for (const i of keep) for (let k = 0; k < 3; k++) {
    kMin[k] = Math.min(kMin[k], a[i * 3 + k]);
    kMax[k] = Math.max(kMax[k], a[i * 3 + k]);
  }
  let idxOut = new Uint32Array(keep);
  if (budget > 0 && idxOut.length / 3 > budget * share(idx.length)) {
    const target = Math.max(3, Math.floor(budget * share(idx.length)) * 3);
    [idxOut] = MeshoptSimplifier.simplify(idxOut, new Float32Array(a), 3, target, 0.05, ["Permissive"]);
  }
  tris += idxOut.length / 3;
  p.getIndices().setArray(new Uint32Array(idxOut));
});
const s = 1 / (kMax[2] - kMin[2]);
const c = [(kMin[0] + kMax[0]) / 2, centre === "1" ? (kMin[1] + kMax[1]) / 2 : kMin[1], (kMin[2] + kMax[2]) / 2];
// A centred prop (a gun) gets its thin end (the tiller behind the breech) at -Z, the muzzle at +Z:
// compare how thick the two ends are, and turn it about Y if needed.
const ends = [[Infinity, -Infinity, Infinity, -Infinity], [Infinity, -Infinity, Infinity, -Infinity]];
eachPrim(doc, (p) => {
  const a = p.getAttribute("POSITION").getArray();
  for (const i of new Set(p.getIndices().getArray())) {
    const z = (a[i * 3 + 2] - c[2]) * s;
    if (Math.abs(z) < 0.4) continue;
    const e = ends[z < 0 ? 0 : 1];
    e[0] = Math.min(e[0], a[i * 3]);
    e[1] = Math.max(e[1], a[i * 3]);
    e[2] = Math.min(e[2], a[i * 3 + 1]);
    e[3] = Math.max(e[3], a[i * 3 + 1]);
  }
});
// Thickness of an end: the lesser of its two extents across the axis (a rod is thin one way at least).
const [endLow, endHigh] = ends.map((e) => Math.min(e[1] - e[0], e[3] - e[2]) * s);
const turnY = centre === "1" && endHigh < endLow ? -1 : 1;
eachPrim(doc, (p) => {
  const pos = p.getAttribute("POSITION");
  const a = pos.getArray();
  for (let i = 0; i < a.length; i += 3) a.set([(a[i] - c[0]) * s * turnY, (a[i + 1] - c[1]) * s, (a[i + 2] - c[2]) * s * turnY], i);
  pos.setArray(a);
  const nor = p.getAttribute("NORMAL");
  if (nor && turnY < 0) {
    const n = nor.getArray();
    for (let i = 0; i < n.length; i += 3) n.set([-n[i], n[i + 1], -n[i + 2]], i);
    nor.setArray(n);
  }
  compactPrimitive(p);
});
// Quantized attributes (KHR_mesh_quantization) halve the file; the loader reads them natively.
await doc.transform(prune(), quantize());
await io.write(output, doc);
console.log(`${input.split("/").pop()}: ends ${endLow.toFixed(3)}/${endHigh.toFixed(3)} turned ${turnY < 0}; ${tris} triangles, beam ${((kMax[0] - kMin[0]) * s).toFixed(3)}, height ${((kMax[1] - kMin[1]) * s).toFixed(3)} of the length`);
