#!/usr/bin/env node
/**
 * Asset pipeline (scripted, repeatable): reads a source GLB, welds and simplifies its meshes with
 * meshoptimizer (Arseny Kapoulkine's quadric simplifier, via glTF-Transform), resizes textures and
 * re-encodes them as WebP, and writes a game-sized GLB.
 *
 * Usage: node tools/assets/optimize.mjs <in.glb> <out.glb> [targetTriangles=60000] [textureSize=1024]
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
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
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }), prune());
await doc.transform(textureCompress({ encoder: sharp, targetFormat: process.env.TEX_FORMAT ?? "webp", resize: [Number(tex), Number(tex)] }));
await io.write(output, doc);
console.log(`${input.split("/").pop()}: ${before} -> ${count()} triangles`);
