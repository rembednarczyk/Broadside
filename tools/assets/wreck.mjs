#!/usr/bin/env node
/**
 * Wreck prop from a site scan lying at any angle (scripted): bakes the transforms, turns the scan
 * to its principal axes (PCA: the keel line along +Z, the flattest direction up), cuts away the
 * ground the scan stands on (everything below a share of the height), sets the lowest point at
 * y = 0 and scales the length to 1. Textures and UVs are kept; the game scales and places it.
 *
 * Usage: node tools/assets/wreck.mjs <in.glb> <out.glb> [flipY=0] [cut=0]
 *   cut: share of the height removed from below (the floor of the scan).
 */
import process from "node:process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { compactPrimitive, flatten, prune, weld } from "@gltf-transform/functions";
import { bake, eachPrim, principalAxes } from "./lib.mjs";

const [input, output, flipY = "0", cut = "0"] = process.argv.slice(2);
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
  tris += keep.length / 3;
  p.getIndices().setArray(new Uint32Array(keep));
});
const s = 1 / (kMax[2] - kMin[2]);
const c = [(kMin[0] + kMax[0]) / 2, kMin[1], (kMin[2] + kMax[2]) / 2];
eachPrim(doc, (p) => {
  const pos = p.getAttribute("POSITION");
  const a = pos.getArray();
  for (let i = 0; i < a.length; i += 3) a.set([(a[i] - c[0]) * s, (a[i + 1] - c[1]) * s, (a[i + 2] - c[2]) * s], i);
  pos.setArray(a);
  compactPrimitive(p);
});
await doc.transform(prune());
await io.write(output, doc);
console.log(`${input.split("/").pop()}: ${tris} triangles, beam ${((kMax[0] - kMin[0]) * s).toFixed(3)}, height ${((kMax[1] - kMin[1]) * s).toFixed(3)} of the length`);
