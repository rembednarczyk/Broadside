#!/usr/bin/env node
/**
 * Asset pipeline (scripted, repeatable): reads a source GLB, welds and simplifies its meshes with
 * meshoptimizer (Arseny Kapoulkine's quadric simplifier, via glTF-Transform), resizes textures and
 * re-encodes them as WebP, and writes a game-sized GLB.
 *
 * Usage: node tools/assets/optimize.mjs <in.glb> <out.glb> [targetTriangles=60000] [textureSize=1024]
 * SIMPLIFY_ERROR (default 0.01) lets small props go below what the default error bound allows.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, prune, quantize, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [input, output, target = "60000", tex = "1024"] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: optimize.mjs <in.glb> <out.glb> [targetTriangles] [textureSize]");
  process.exit(1);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const count = () => {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3;
  return Math.round(t);
};
const before = count();
await MeshoptSimplifier.ready;
await doc.transform(dedup(), flatten(), join(), weld());
const ratio = Math.min(1, Number(target) / Math.max(1, count()));
// A budget at or above the mesh keeps every triangle (no simplifier pass at all). When simplifying,
// LOCK_BORDER=1 keeps the open edges and the seams between UV islands where they are: without it
// the two sides of a seam are collapsed separately and the surface opens along it.
if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(process.env.SIMPLIFY_ERROR ?? 0.01), lockBorder: process.env.LOCK_BORDER === "1" }));
await doc.transform(prune());
await doc.transform(textureCompress({ encoder: sharp, targetFormat: process.env.TEX_FORMAT ?? "webp", resize: [Number(tex), Number(tex)] }));
// QUANTIZE=1: 16-bit positions and compact normals/UVs (KHR_mesh_quantization), about half the file.
if (process.env.QUANTIZE === "1") await doc.transform(quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }));
await io.write(output, doc);
console.log(`${input.split("/").pop()}: ${before} -> ${count()} triangles`);
