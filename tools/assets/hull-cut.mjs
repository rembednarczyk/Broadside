#!/usr/bin/env node
/**
 * Hull extraction (scripted): takes an optimized ship GLB, bakes all node transforms, turns it so the
 * length runs along +Z with the bow forward and +Y up, cuts away everything above a given height
 * (masts, yards, sails, rigging: the game draws those itself, animated), drops small loose pieces
 * (rope ends, flags) by connected-component size (union-find over shared vertices), and puts the
 * keel at y = 0 with the hull centred. The game scales the result to the physics hull of a class.
 *
 * Config: tools/assets/hulls.json, entries { "class", "source", "lengthAxis": "x"|"z",
 *   "bowAtMin": bool | null (null: the lower end is the bow), "cut": share of height above the keel,
 *   "flipY": bool, "minPiece": share of vertices below which a piece is dropped,
 *   "keepMaterials": optional list of material names that hold the hull }.
 * Usage: node tools/assets/hull-cut.mjs <in-dir> <out-dir> [class]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { bake, eachPrim } from "./lib.mjs";
import { compactPrimitive, flatten, join as joinMeshes, prune, weld } from "@gltf-transform/functions";

const [inDir, outDir, only] = process.argv.slice(2);
const config = JSON.parse(readFileSync(new URL("./hulls.json", import.meta.url), "utf8"));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const c of config.filter((x) => !only || x.class === only)) {
  const doc = await io.read(join(inDir, c.source));
  // Models that keep their hull in its own material: drop every other material's geometry first.
  if (c.keepMaterials) {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const p of mesh.listPrimitives()) if (!c.keepMaterials.includes(p.getMaterial()?.getName() ?? "")) p.dispose();
    }
  }
  await doc.transform(flatten());
  bake(doc);
  await doc.transform(joinMeshes(), weld());
  // Reorient: length along +Z, up +Y.
  const remap = (x, y, z) => {
    let v = c.lengthAxis === "x" ? [z, y, x] : [x, y, z];
    if (c.flipY) v = [v[0], -v[1], -v[2]];
    return v;
  };
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION");
    const a = pos.getArray();
    for (let i = 0; i < a.length; i += 3) {
      const v = remap(a[i], a[i + 1], a[i + 2]);
      a.set(v, i);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
    pos.setArray(a);
    const nor = p.getAttribute("NORMAL");
    if (nor) {
      const n = nor.getArray();
      for (let i = 0; i < n.length; i += 3) n.set(remap(n[i], n[i + 1], n[i + 2]), i);
      nor.setArray(n);
    }
  });
  const cutY = min[1] + (max[1] - min[1]) * c.cut;
  // Cut: drop triangles with any vertex above the deck line; then drop small pieces.
  let hullMin = [Infinity, Infinity, Infinity];
  let hullMax = [-Infinity, -Infinity, -Infinity];
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION").getArray();
    const idx = p.getIndices().getArray();
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      if ([idx[t], idx[t + 1], idx[t + 2]].every((i) => pos[i * 3 + 1] <= cutY)) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    // Union-find over the kept triangles' vertices.
    const parent = new Map();
    const find = (a) => {
      while (parent.get(a) !== a) {
        parent.set(a, parent.get(parent.get(a)));
        a = parent.get(a);
      }
      return a;
    };
    for (const i of keep) if (!parent.has(i)) parent.set(i, i);
    for (let t = 0; t < keep.length; t += 3) {
      const r = find(keep[t]);
      parent.set(find(keep[t + 1]), r);
      parent.set(find(keep[t + 2]), find(r));
    }
    const size = new Map();
    for (const i of parent.keys()) size.set(find(i), (size.get(find(i)) ?? 0) + 1);
    const total = parent.size;
    const kept = [];
    for (let t = 0; t < keep.length; t += 3) if ((size.get(find(keep[t])) ?? 0) >= total * c.minPiece) kept.push(keep[t], keep[t + 1], keep[t + 2]);
    for (const i of kept) {
      for (let k = 0; k < 3; k++) {
        hullMin[k] = Math.min(hullMin[k], pos[i * 3 + k]);
        hullMax[k] = Math.max(hullMax[k], pos[i * 3 + k]);
      }
    }
    p.getIndices().setArray(new Uint32Array(kept));
  });
  // Trim the ends where the cross-section is thin (bowsprit, stern lantern, ensign staff): slices of
  // the length narrower than 15% of the beam do not belong to the hull.
  const BINS = 120;
  const width = new Array(BINS).fill(0);
  const bin = (z) => Math.min(BINS - 1, Math.max(0, Math.floor(((z - hullMin[2]) / (hullMax[2] - hullMin[2])) * BINS)));
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION").getArray();
    for (const i of p.getIndices().getArray()) width[bin(pos[i * 3 + 2])] = Math.max(width[bin(pos[i * 3 + 2])], Math.abs(pos[i * 3] - (hullMin[0] + hullMax[0]) / 2));
  });
  const wMax = Math.max(...width);
  const lo = width.findIndex((w) => w >= wMax * 0.15);
  const hi = BINS - 1 - [...width].reverse().findIndex((w) => w >= wMax * 0.15);
  const zLo = hullMin[2] + (lo / BINS) * (hullMax[2] - hullMin[2]);
  const zHi = hullMin[2] + ((hi + 1) / BINS) * (hullMax[2] - hullMin[2]);
  hullMin = [Infinity, Infinity, Infinity];
  hullMax = [-Infinity, -Infinity, -Infinity];
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION").getArray();
    const idx = p.getIndices().getArray();
    const kept = [];
    for (let t = 0; t < idx.length; t += 3) {
      const zc = (pos[idx[t] * 3 + 2] + pos[idx[t + 1] * 3 + 2] + pos[idx[t + 2] * 3 + 2]) / 3;
      if (zc >= zLo && zc <= zHi) kept.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    for (const i of kept) {
      for (let k = 0; k < 3; k++) {
        hullMin[k] = Math.min(hullMin[k], pos[i * 3 + k]);
        hullMax[k] = Math.max(hullMax[k], pos[i * 3 + k]);
      }
    }
    p.getIndices().setArray(new Uint32Array(kept));
  });
  // Bow: the lower end (castles stand aft) unless the config says.
  const zMid = (hullMin[2] + hullMax[2]) / 2;
  let lowFront = -Infinity;
  let lowBack = -Infinity;
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION").getArray();
    for (const i of p.getIndices().getArray()) {
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      if (z > hullMax[2] - (hullMax[2] - hullMin[2]) * 0.12) lowFront = Math.max(lowFront, y);
      if (z < hullMin[2] + (hullMax[2] - hullMin[2]) * 0.12) lowBack = Math.max(lowBack, y);
    }
  });
  const bowAtMin = c.bowAtMin ?? lowBack < lowFront;
  const sz = bowAtMin ? -1 : 1;
  const xMid = (hullMin[0] + hullMax[0]) / 2;
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION");
    const a = pos.getArray();
    for (let i = 0; i < a.length; i += 3) {
      a[i] = (a[i] - xMid) * sz;
      a[i + 1] = a[i + 1] - hullMin[1];
      a[i + 2] = (a[i + 2] - zMid) * sz;
    }
    pos.setArray(a);
    const nor = p.getAttribute("NORMAL");
    if (nor && sz < 0) {
      const n = nor.getArray();
      for (let i = 0; i < n.length; i += 3) {
        n[i] = -n[i];
        n[i + 2] = -n[i + 2];
      }
      nor.setArray(n);
    }
  });
  // Drop vertices no triangle uses any more (bounds and file size).
  eachPrim(doc, (p) => compactPrimitive(p));
  await doc.transform(prune());
  await io.write(join(outDir, `${c.class}.glb`), doc);
  // Gunwale height amidships (top of the hull in the middle fifth of the length): the game fits it
  // to the physics hull's deck plus bulwark.
  // A percentile, not the maximum: shroud stubs and fittings reach higher than the planking.
  const sideY = [];
  const half = (hullMax[0] - hullMin[0]) / 2;
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION").getArray();
    for (const i of new Set(p.getIndices().getArray())) {
      if (Math.abs(pos[i * 3 + 2]) < (hullMax[2] - hullMin[2]) * 0.1 && Math.abs(pos[i * 3]) > half * 0.7) sideY.push(pos[i * 3 + 1]);
    }
  });
  sideY.sort((a, b) => a - b);
  const gunwale = sideY[Math.floor(sideY.length * (c.gunwalePercentile ?? 0.85))] ?? hullMax[1];
  writeFileSync(join(outDir, `${c.class}.json`), JSON.stringify({ beam: +(hullMax[0] - hullMin[0]).toFixed(3), length: +(hullMax[2] - hullMin[2]).toFixed(3), gunwale: +gunwale.toFixed(3) }) + "\n");
  const L = hullMax[2] - hullMin[2];
  console.log(`${c.class} <- ${c.source}: length ${L.toFixed(2)}, beam ${(hullMax[0] - hullMin[0]).toFixed(2)}, height ${(hullMax[1] - hullMin[1]).toFixed(2)}, gunwale ${gunwale.toFixed(2)}, bow at ${bowAtMin ? "min" : "max"} (ends ${lowBack.toFixed(2)}/${lowFront.toFixed(2)})`);
}
