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
 *   "keepMaterials": optional list of material names that hold the hull,
 *   "remnantShare": share of the mesh below which a separate part crossing the cut counts as
 *     rigging and is removed whole (off by default: a photogrammetry scan is hundreds of fragments),
 *   "stumps": one rule or a list of { "above": share of the cut hull's height, "root": lower share (optional), "area": share of beam x length }: what stands above that height
 *     on a footprint smaller than that (the cut ends of shrouds and stays on a model fused into one mesh,
 *     where a castle's bulwark is a wide island) is removed,
 *   "gain": optional brightness of the colour texture in the game (dark, tarred models need more) }.
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
  let remnants = 0;
  let remnantParts = 0;
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION").getArray();
    const idx = p.getIndices().getArray();
    // Rigging remnants: a part of the model that crosses the cut (a mast, a shroud, a stay, a
    // lanyard) would be left as a stump standing on the hull. Parts are the connected components
    // of the mesh with vertices welded by position (union-find); a part that crosses the cut and
    // holds only a small share of the mesh is rigging and goes whole. The hull and its castles are
    // large parts: they stay and are cut.
    const cell = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 1e-5;
    const keyOf = (i) => `${Math.round(pos[i * 3] / cell)},${Math.round(pos[i * 3 + 1] / cell)},${Math.round(pos[i * 3 + 2] / cell)}`;
    const welded = new Map();
    const node = new Int32Array(pos.length / 3);
    for (let i = 0; i < node.length; i++) {
      const k = keyOf(i);
      if (!welded.has(k)) welded.set(k, welded.size);
      node[i] = welded.get(k);
    }
    const up = new Int32Array(welded.size).map((_, i) => i);
    const root = (a) => {
      while (up[a] !== a) {
        up[a] = up[up[a]];
        a = up[a];
      }
      return a;
    };
    for (let t = 0; t < idx.length; t += 3) {
      const r = root(node[idx[t]]);
      up[root(node[idx[t + 1]])] = r;
      up[root(node[idx[t + 2]])] = root(r);
    }
    const part = new Map();
    for (let i = 0; i < node.length; i++) {
      const r = root(node[i]);
      const q = part.get(r) ?? { n: 0, above: false, below: false };
      q.n++;
      if (pos[i * 3 + 1] > cutY) q.above = true;
      else q.below = true;
      part.set(r, q);
    }
    if (process.env.PARTS) console.log([...part.values()].filter((q) => q.above && q.below).sort((a, b) => b.n - a.n).slice(0, 12).map((q) => `${((q.n / node.length) * 100).toFixed(2)}%`).join(" "), "| parts", part.size);
    const remnantShare = c.remnantShare ?? 0;
    const remnant = (i) => {
      const q = part.get(root(node[i]));
      return q.above && q.below && q.n < node.length * remnantShare;
    };
    let keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      if (remnant(tri[0])) {
        remnants++;
        continue;
      }
      if (tri.every((i) => pos[i * 3 + 1] <= cutY)) keep.push(...tri);
    }
    remnantParts += [...part.values()].filter((q) => q.above && q.below && q.n < node.length * remnantShare).length;
    // Stumps on a model fused into one mesh: look only at what stands above the rail line. There
    // the mesh falls apart into separate islands (union-find again, over the triangles wholly above
    // the line): a castle's bulwark is a wide island, the cut end of a shroud or a stay a thin one.
    // Several rules may run in turn (tall stumps over a wide footprint, then short ones over a small).
    for (const rule of [c.stumps ?? []].flat()) {
      const line = min[1] + (cutY - min[1]) * rule.above;
      // Footprint below which an island is a stump (a share of beam times length of the whole model).
      const small = (max[0] - min[0]) * (max[2] - min[2]) * rule.area;
      const top = new Int32Array(welded.size).map((_, i) => i);
      const rootTop = (a) => {
        while (top[a] !== a) {
          top[a] = top[top[a]];
          a = top[a];
        }
        return a;
      };
      const high = (t) => keep[t] !== undefined && [keep[t], keep[t + 1], keep[t + 2]].every((i) => pos[i * 3 + 1] > line);
      for (let t = 0; t < keep.length; t += 3) {
        if (!high(t)) continue;
        const r = rootTop(node[keep[t]]);
        top[rootTop(node[keep[t + 1]])] = r;
        top[rootTop(node[keep[t + 2]])] = rootTop(r);
      }
      const box = new Map();
      for (let t = 0; t < keep.length; t += 3) {
        if (!high(t)) continue;
        const r = rootTop(node[keep[t]]);
        const b = box.get(r) ?? [Infinity, -Infinity, Infinity, -Infinity];
        for (const i of [keep[t], keep[t + 1], keep[t + 2]]) {
          b[0] = Math.min(b[0], pos[i * 3]);
          b[1] = Math.max(b[1], pos[i * 3]);
          b[2] = Math.min(b[2], pos[i * 3 + 2]);
          b[3] = Math.max(b[3], pos[i * 3 + 2]);
        }
        box.set(r, b);
      }
      const isStump = (r) => {
        const b = box.get(r);
        return (b[1] - b[0]) * (b[3] - b[2]) < small;
      };
      // A stump is found where it stands clear, above the line, but it grows out of the rail a
      // little lower: take it off down to its root (`root`, a lower share of the height), within
      // the footprint of the island found above.
      const stumps = [...box.entries()].filter(([r]) => isStump(r)).map(([, b]) => b);
      const rootLine = min[1] + (cutY - min[1]) * (rule.root ?? rule.above);
      const pad = (max[0] - min[0]) * 0.004;
      const inStump = (t) => {
        const x = (pos[keep[t] * 3] + pos[keep[t + 1] * 3] + pos[keep[t + 2] * 3]) / 3;
        const z = (pos[keep[t] * 3 + 2] + pos[keep[t + 1] * 3 + 2] + pos[keep[t + 2] * 3 + 2]) / 3;
        return stumps.some((b) => x > b[0] - pad && x < b[1] + pad && z > b[2] - pad && z < b[3] + pad);
      };
      const kept2 = [];
      for (let t = 0; t < keep.length; t += 3) {
        const aboveRoot = [keep[t], keep[t + 1], keep[t + 2]].every((i) => pos[i * 3 + 1] > rootLine);
        if ((high(t) && isStump(rootTop(node[keep[t]]))) || (aboveRoot && inStump(t))) {
          remnants++;
          continue;
        }
        kept2.push(keep[t], keep[t + 1], keep[t + 2]);
      }
      remnantParts += [...box.keys()].filter(isStump).length;
      keep = kept2;
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
  // Profile of the side for the game's own fittings (rails, channels, shroud feet): in stations
  // along the length, the half-breadth near the top of the side and the height of the bulwark's top
  // there (percentiles, so a gun muzzle or a stray vertex does not count). Model units, bow +Z.
  const STATIONS = 64;
  const L0 = hullMax[2] - hullMin[2];
  const xs = Array.from({ length: STATIONS }, () => []);
  const pts = Array.from({ length: STATIONS }, () => []);
  eachPrim(doc, (p) => {
    const pos = p.getAttribute("POSITION").getArray();
    for (const i of new Set(p.getIndices().getArray())) {
      const k = Math.min(STATIONS - 1, Math.max(0, Math.floor((pos[i * 3 + 2] / L0 + 0.5) * STATIONS)));
      const y = pos[i * 3 + 1];
      pts[k].push([Math.abs(pos[i * 3]), y]);
      if (y > gunwale * 0.6 && y < gunwale * 1.02) xs[k].push(Math.abs(pos[i * 3]));
    }
  });
  const pct = (v, q) => (v.length ? v.sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * q))] : 0);
  const halfAt = xs.map((v) => +pct(v, 0.85).toFixed(3));
  const topAt = pts.map((v, k) => +pct(v.filter(([x]) => x >= halfAt[k] * 0.85).map(([, y]) => y), 0.98).toFixed(3));
  const metrics = { beam: +(hullMax[0] - hullMin[0]).toFixed(3), length: +L0.toFixed(3), gunwale: +gunwale.toFixed(3), ...(c.gain ? { gain: c.gain } : {}), profile: { half: halfAt, top: topAt } };
  writeFileSync(join(outDir, `${c.class}.json`), JSON.stringify(metrics) + "\n");
  const L = hullMax[2] - hullMin[2];
  console.log(`${c.class} <- ${c.source}: length ${L.toFixed(2)}, beam ${(hullMax[0] - hullMin[0]).toFixed(2)}, height ${(hullMax[1] - hullMin[1]).toFixed(2)}, gunwale ${gunwale.toFixed(2)}, bow at ${bowAtMin ? "min" : "max"} (ends ${lowBack.toFixed(2)}/${lowFront.toFixed(2)}); rigging remnants removed: ${remnantParts} parts, ${remnants} triangles`);
}
