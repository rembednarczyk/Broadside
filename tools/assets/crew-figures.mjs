#!/usr/bin/env node
/**
 * Crew figures for the decks (scripted, deterministic): Quaternius's CC0 characters (Modular
 * Character Outfits - Fantasy, Universal Base Characters, Universal Animation Library; one skeleton
 * for all three) put together and baked into small static miniatures:
 *
 * 1. an outfit (body, arms, legs, feet) and the head of a base character (the triangles whose
 *    vertices hang mostly on the neck and head bones: the outfit covers the rest, as its readme
 *    says to do), with a hairstyle rigged to the head bone;
 * 2. posed by one frame of an animation of the library (rotations of the joints by name; the rest
 *    translations of the target skeleton are kept, so the body keeps its own proportions);
 * 3. skinned on the CPU (linear blend skinning, glTF 2.0 §3.7.3) into a static mesh;
 * 4. textured from one atlas: every base colour texture the figures use (outfits, skin, hair,
 *    eyes) packed in a grid of 512 px cells, the UVs moved into their cell (one material and one
 *    texture for every figure, which lets the game draw them as thin instances); a material's
 *    colour factor goes to the vertex colour;
 * 5. simplified with meshoptimizer (edge collapse, UV seams kept) to a triangle budget, feet at
 *    y = 0, facing +z.
 *
 * Usage: node tools/assets/crew-figures.mjs <out.glb> [triangles=5000]
 *   CREW_SPREAD=1 stands the figures side by side 1.2 m apart (for a preview with view.mjs).
 * Sources: downloaded with tools/assets/itch-fetch.sh into .asset-cache/quaternius (see README).
 */
import { readFileSync } from "node:fs";
import process from "node:process";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [out, triangles = "5000"] = process.argv.slice(2);
if (!out) {
  console.error("usage: crew-figures.mjs <out.glb> [triangles=5000]");
  process.exit(1);
}
const Q = ".asset-cache/quaternius";
const OUTFITS = `${Q}/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits`;
const BASE = `${Q}/Universal Base Characters[Standard]/Base Characters/Godot - UE`;
const HAIR = `${Q}/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
const ANIMS = `${Q}/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`;

/** The figures: outfit, hair, pose (animation and time) and the body texture variant. */
const FIGURES = [
  { name: "deckhand", outfit: "Male_Peasant", hair: ["Hair_Beard", "Hair_SimpleParted"], pose: ["Idle_Loop", 0] },
  { name: "talker", outfit: "Male_Peasant", hair: ["Hair_Buzzed"], pose: ["Idle_Talking_Loop", 0.6], tint: "T_Peasant_2_BaseColor" },
  { name: "lookout", outfit: "Male_Ranger", hair: ["Hair_Beard"], pose: ["Idle_Loop", 1.2] },
  { name: "hauler", outfit: "Male_Peasant", hair: ["Hair_Long"], pose: ["Push_Loop", 0.4], tint: "T_Peasant_2_BaseColor" },
  { name: "officer", outfit: "Male_Ranger", hair: ["Hair_SimpleParted", "Hair_Beard"], pose: ["Idle_Talking_Loop", 1.5] },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// --- 4x4 matrices, column-major as in glTF ---
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const trs = (t, q, s) => {
  const [x, y, z, w] = q;
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
};
const apply = (m, v, w) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * w);

/** Joint rotations of one frame of an animation, by joint name (nearest key at or before t, slerped to the next). */
const poseOf = (animDoc, animName, t) => {
  const anim = animDoc.getRoot().listAnimations().find((a) => a.getName() === animName);
  if (!anim) throw new Error(`no animation ${animName}`);
  const rot = new Map();
  for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== "rotation") continue;
    const s = ch.getSampler();
    const times = s.getInput().getArray();
    const vals = s.getOutput().getArray();
    let i = 0;
    while (i + 1 < times.length && times[i + 1] <= t) i++;
    const j = Math.min(times.length - 1, i + 1);
    const f = j === i ? 0 : Math.max(0, Math.min(1, (t - times[i]) / (times[j] - times[i])));
    const a = [...vals.slice(i * 4, i * 4 + 4)];
    const b = [...vals.slice(j * 4, j * 4 + 4)];
    if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) for (let k = 0; k < 4; k++) b[k] = -b[k];
    const q = a.map((x, k) => x + (b[k] - x) * f);
    const n = Math.hypot(...q);
    rot.set(ch.getTargetNode().getName(), q.map((x) => x / n));
  }
  return rot;
};

/** World matrix of every node of a document, with the pose's rotations put on the joints it names. */
const worldOf = (doc, pose) => {
  const world = new Map();
  const visit = (node, parent) => {
    const local = trs(node.getTranslation(), pose.get(node.getName()) ?? node.getRotation(), node.getScale());
    const m = mul(parent, local);
    world.set(node, m);
    for (const child of node.listChildren()) visit(child, m);
  };
  const identity = trs([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) visit(node, identity);
  return world;
};

/** The atlas: cell 0 is plain white (untextured materials), then one cell per texture. */
const CELL = 512;
const COLS = 4;
const INSET = 0.01;
const cells = ["white"];
const cellOf = (path) => {
  if (!cells.includes(path)) cells.push(path);
  return cells.indexOf(path);
};
const rowsOf = () => Math.ceil(cells.length / COLS);
/** A UV in the atlas (top-left origin, as glTF's). */
const atlasUv = (cell, u, v) => {
  const f = (x) => INSET + (((x % 1) + 1) % 1) * (1 - 2 * INSET);
  return [((cell % COLS) + f(u)) / COLS, (Math.floor(cell / COLS) + f(v)) / rowsOf()];
};

/**
 * The skinned, posed triangles of a document as flat arrays (positions, normals, colours), each
 * coloured from its material. `keep(joint names of a triangle's vertices)` filters triangles.
 */
const posedTriangles = async (file, pose, keep = () => true, tint = null) => {
  const doc = await io.read(file);
  const world = worldOf(doc, pose);
  const out = { pos: [], nrm: [], col: [], uv: [], cell: [] };
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || !skin) continue;
    const joints = skin.listJoints();
    const ibm = skin.getInverseBindMatrices().getArray();
    const palette = joints.map((j, k) => mul(world.get(j), [...ibm.slice(k * 16, k * 16 + 16)]));
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute("POSITION");
      const N = prim.getAttribute("NORMAL");
      const UV = prim.getAttribute("TEXCOORD_0");
      const J = prim.getAttribute("JOINTS_0");
      const W = prim.getAttribute("WEIGHTS_0");
      const mat = prim.getMaterial();
      const factor = mat?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const texInfo = mat?.getBaseColorTexture();
      let cell = 0;
      if (texInfo) {
        const uri = texInfo.getURI();
        const dir = file.slice(0, file.lastIndexOf("/") + 1);
        cell = cellOf(tint && /Peasant_BaseColor/.test(uri) ? `${Q}/Modular Character Outfits - Fantasy[Standard]/Textures/Peasant/${tint}.png` : dir + uri);
      }
      const v = (i) => {
        const p = P.getElement(i, []);
        const n = N ? N.getElement(i, []) : [0, 1, 0];
        const j = J.getElement(i, []);
        const w = W.getElement(i, []);
        const sp = [0, 0, 0];
        const sn = [0, 0, 0];
        for (let k = 0; k < 4; k++) {
          if (w[k] <= 0) continue;
          const a = apply(palette[j[k]], p, 1);
          const b = apply(palette[j[k]], n, 0);
          for (let d = 0; d < 3; d++) {
            sp[d] += a[d] * w[k];
            sn[d] += b[d] * w[k];
          }
        }
        const len = Math.hypot(...sn) || 1;
        const uv = UV ? UV.getElement(i, []) : [0.5, 0.5];
        const dominant = j[w.indexOf(Math.max(...w))];
        return { p: sp, n: sn.map((x) => x / len), c: [factor[0], factor[1], factor[2]], uv, joint: joints[dominant].getName() };
      };
      const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: P.getCount() }, (_, i) => i);
      const cache = new Map();
      const vert = (i) => {
        if (!cache.has(i)) cache.set(i, v(i));
        return cache.get(i);
      };
      for (let t = 0; t < idx.length; t += 3) {
        const tri = [vert(idx[t]), vert(idx[t + 1]), vert(idx[t + 2])];
        if (!keep(tri.map((x) => x.joint))) continue;
        for (const x of tri) {
          out.pos.push(...x.p);
          out.nrm.push(...x.n);
          out.col.push(...x.c);
          out.uv.push(...x.uv);
          out.cell.push(cell);
        }
      }
    }
  }
  return out;
};

const HEAD = new Set(["neck_01", "Head"]);
const headOnly = (names) => names.every((n) => HEAD.has(n) || /eye|jaw|head|teeth|tongue/i.test(n));

await MeshoptSimplifier.ready;
const animDoc = await io.read(ANIMS);
/** Each figure posed, welded and simplified; UVs still in their source texture, with its cell. */
const built = [];
for (const [fi, f] of FIGURES.entries()) {
  const pose = poseOf(animDoc, f.pose[0], f.pose[1]);
  const parts = [
    await posedTriangles(`${OUTFITS}/${f.outfit}.gltf`, pose, () => true, f.tint ?? null),
    await posedTriangles(`${BASE}/Superhero_Male_FullBody.gltf`, pose, headOnly),
    ...(await Promise.all(f.hair.map((h) => posedTriangles(`${HAIR}/${h}.gltf`, pose)))),
  ];
  const all = (k) => parts.flatMap((p) => p[k]);
  const [pos, nrm, col, uv, cell] = ["pos", "nrm", "col", "uv", "cell"].map(all);
  // Weld equal corners (same place, same texture point), then simplify by edge collapse; the seams
  // of the UVs are borders the collapse keeps, so the texture stays whole.
  const key = new Map();
  const remap = [];
  const V = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const k = `${pos.slice(i * 3, i * 3 + 3).map((x) => x.toFixed(4))},${uv[i * 2].toFixed(4)},${uv[i * 2 + 1].toFixed(4)},${cell[i]}`;
    if (!key.has(k)) {
      key.set(k, V.length);
      V.push({ p: pos.slice(i * 3, i * 3 + 3), n: nrm.slice(i * 3, i * 3 + 3), c: col.slice(i * 3, i * 3 + 3), uv: uv.slice(i * 2, i * 2 + 2), cell: cell[i] });
    }
    remap.push(key.get(k));
  }
  const positions = Float32Array.from(V.flatMap((v) => v.p));
  const target = Math.min(remap.length, Number(triangles) * 3);
  const [simplified] = MeshoptSimplifier.simplify(Uint32Array.from(remap), positions, 3, target, 0.012, []);
  let minY = Infinity;
  let cx = 0;
  let cz = 0;
  for (const v of V) {
    minY = Math.min(minY, v.p[1]);
    cx += v.p[0] / V.length;
    cz += v.p[2] / V.length;
  }
  const used = new Map();
  const verts = [];
  const index = [];
  for (const i of simplified) {
    if (!used.has(i)) {
      used.set(i, verts.length);
      const v = V[i];
      verts.push({ ...v, p: [v.p[0] - cx + (process.env.CREW_SPREAD === "1" ? fi * 1.2 : 0), v.p[1] - minY, v.p[2] - cz] });
    }
    index.push(used.get(i));
  }
  built.push({ name: f.name, verts, index });
  console.log(`${f.name}: ${remap.length / 3} -> ${index.length / 3} triangles, height ${Math.max(...verts.map((v) => v.p[1])).toFixed(2)} m`);
}

// The atlas, now that every texture is known.
const rows = rowsOf();
const composite = await Promise.all(cells.slice(1).map(async (path, k) => ({
  input: await sharp(readFileSync(path)).removeAlpha().resize(CELL, CELL, { fit: "fill" }).toBuffer(),
  left: ((k + 1) % COLS) * CELL,
  top: Math.floor((k + 1) / COLS) * CELL,
})));
const atlas = await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 3, background: "#ffffff" } }).composite(composite).jpeg({ quality: 86 }).toBuffer();

const doc = new Document();
const buffer = doc.createBuffer();
const texture = doc.createTexture("crew-atlas").setImage(atlas).setMimeType("image/jpeg");
const material = doc.createMaterial("crew").setBaseColorTexture(texture).setRoughnessFactor(0.85).setMetallicFactor(0);
const scene = doc.createScene("crew");
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
for (const b of built) {
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", acc("VEC3", Float32Array.from(b.verts.flatMap((v) => v.p))))
    .setAttribute("NORMAL", acc("VEC3", Float32Array.from(b.verts.flatMap((v) => v.n))))
    .setAttribute("TEXCOORD_0", acc("VEC2", Float32Array.from(b.verts.flatMap((v) => atlasUv(v.cell, v.uv[0], v.uv[1])))))
    .setAttribute("COLOR_0", acc("VEC4", Float32Array.from(b.verts.flatMap((v) => [...v.c, 1]))))
    .setIndices(acc("SCALAR", Uint16Array.from(b.index)))
    .setMaterial(material);
  scene.addChild(doc.createNode(`crew-${b.name}`).setMesh(doc.createMesh(`crew-${b.name}`).addPrimitive(prim)));
}
await io.write(out, doc);
console.log(`${out}: atlas ${COLS * CELL}x${rows * CELL}, ${cells.length - 1} textures`);
