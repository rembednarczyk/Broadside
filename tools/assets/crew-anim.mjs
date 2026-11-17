#!/usr/bin/env node
/**
 * Animated crew for the decks (scripted, deterministic): Quaternius's CC0 characters (Modular
 * Character Outfits - Fantasy, Universal Base Characters, Universal Animation Library 1 and 2; one
 * rig for all of them) put together as skinned figures, with the library's animations baked into one texture
 * of joint matrices (a vertex animation texture, the layout of Babylon's VertexAnimationBaker:
 * per frame a row of (joints + 1) matrices, the last the identity). The game draws every man of a
 * figure as a thin instance that plays its own clip from that texture
 * (BakedVertexAnimationManager), so a deck full of men at different work costs one draw call per
 * figure. Babylon's own baker samples skeleton animations only; the library's are glTF node
 * animations, so the matrices are computed here, with the same skinning maths (glTF 2.0 §3.7.3).
 *
 * 1. Each figure: an outfit, the head of a base character (the triangles hanging on the neck and
 *    head bones; the outfit covers the rest, as its readme says) and a hairstyle, all brought into
 *    the bind pose of the outfit's skeleton, the canonical one (same 65 joints, same proportions).
 * 2. Clips: joint rotations from the library (its mannequin is shorter in the neck: rotations
 *    only, and the pelvis's translation scaled to the outfit's hip height), sampled at FPS.
 *    Matrix of joint j in frame f: posedWorld_j(f) * inverse(restWorld_j).
 * 3. Textures packed in one atlas (512 px cells), UVs moved into their cell.
 * 4. Edge collapse to a triangle budget (meshoptimizer; UV seams are borders it keeps).
 *
 * Output: one binary file: "BCRW", version, header length, a JSON header (joints, fps, clips,
 * figures and the byte ranges of their arrays), then the arrays and the atlas (JPEG). Coordinates
 * are glTF's (right-handed); the game builds the meshes itself, so they come out mirrored left to
 * right, which a man does not mind; it draws both faces.
 *
 * Usage: node tools/assets/crew-anim.mjs <out.bin> [triangles=5000] [fps=15]
 * Sources: tools/assets/itch-fetch.sh into .asset-cache/quaternius (see README).
 */
import { Buffer } from "node:buffer";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [out, triangles = "5000", fpsArg = "15"] = process.argv.slice(2);
if (!out) {
  console.error("usage: crew-anim.mjs <out.bin> [triangles=5000] [fps=15]");
  process.exit(1);
}
const FPS = Number(fpsArg);
const Q = ".asset-cache/quaternius";
const OUTFITS = `${Q}/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits`;
const PEASANT_TEX = `${Q}/Modular Character Outfits - Fantasy[Standard]/Textures/Peasant`;
const BASE = `${Q}/Universal Base Characters[Standard]/Base Characters/Godot - UE`;
const HAIR = `${Q}/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
const ANIMS = `${Q}/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`;
const ANIMS2 = `${Q}/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb`;

/** The figures: outfit, hair and the outfit's texture variant. */
const FIGURES = [
  { name: "deckhand", outfit: "Male_Peasant", hair: ["Hair_Beard", "Hair_SimpleParted"] },
  { name: "seaman", outfit: "Male_Peasant", hair: ["Hair_Buzzed"], tint: "T_Peasant_2_BaseColor" },
  { name: "bosun", outfit: "Male_Ranger", hair: ["Hair_Beard"] },
  { name: "topman", outfit: "Male_Peasant", hair: ["Hair_Long"], tint: "T_Peasant_2_BaseColor" },
  { name: "officer", outfit: "Male_Ranger", hair: ["Hair_SimpleParted", "Hair_Beard"] },
];
/** The clips the game plays (its names, from the libraries' animations; `lib: 2` the second library). */
const CLIPS = [
  { name: "idle", anim: "Idle_Loop" },
  { name: "talk", anim: "Idle_Talking_Loop" },
  { name: "haul", anim: "Push_Loop" },
  { name: "wheel", anim: "Driving_Loop" },
  { name: "work", anim: "Fixing_Kneeling" },
  { name: "handle", anim: "Interact" },
  { name: "lookout", anim: "Idle_Torch_Loop" },
  { name: "rail", anim: "Idle_Rail_Loop", lib: 2 },
  { name: "call", anim: "Idle_Rail_Call", lib: 2 },
  { name: "arms", anim: "Idle_FoldArms_Loop", lib: 2 },
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
/** Inverse of an affine matrix (rotation and scale, then translation). */
const invert = (m) => {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const r = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const it = [0, 1, 2].map((k) => -(r[k * 3] * t[0] + r[k * 3 + 1] * t[1] + r[k * 3 + 2] * t[2]));
  return [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, it[0], it[1], it[2], 1];
};

/** Sample of an animation sampler at time t (linear; quaternions normalised, on the short arc). */
const sample = (s, t, size) => {
  const times = s.getInput().getArray();
  const vals = s.getOutput().getArray();
  let i = 0;
  while (i + 1 < times.length && times[i + 1] <= t) i++;
  const j = Math.min(times.length - 1, i + 1);
  const f = j === i ? 0 : Math.max(0, Math.min(1, (t - times[i]) / (times[j] - times[i])));
  const a = [...vals.slice(i * size, i * size + size)];
  const b = [...vals.slice(j * size, j * size + size)];
  if (size === 4 && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) for (let k = 0; k < 4; k++) b[k] = -b[k];
  const v = a.map((x, k) => x + (b[k] - x) * f);
  if (size !== 4) return v;
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};

/** World matrix of every node of a document, with a pose (rotation and translation by node name). */
const worldOf = (doc, pose = { rot: new Map(), pos: new Map() }) => {
  const byName = new Map();
  const visit = (node, parent) => {
    const name = node.getName();
    const m = mul(parent, trs(pose.pos.get(name) ?? node.getTranslation(), pose.rot.get(name) ?? node.getRotation(), node.getScale()));
    byName.set(name, m);
    for (const child of node.listChildren()) visit(child, m);
  };
  const identity = trs([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) visit(node, identity);
  return byName;
};

// --- the atlas ---
const CELL = 512;
const COLS = 4;
const INSET = 0.01;
const cells = ["white"];
const cellOf = (path) => {
  if (!cells.includes(path)) cells.push(path);
  return cells.indexOf(path);
};

/**
 * The triangles of a document in the canonical bind pose, flat per corner: position, normal, source
 * UV and atlas cell, canonical joints and weights. `keep(joint names)` filters triangles.
 */
const bindTriangles = async (file, canon, keep = () => true, tint = null) => {
  const doc = await io.read(file);
  const rest = worldOf(doc);
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || !skin) continue;
    const joints = skin.listJoints().map((j) => j.getName());
    const ibm = skin.getInverseBindMatrices().getArray();
    const bind = joints.map((name, k) => mul(rest.get(name), [...ibm.slice(k * 16, k * 16 + 16)]));
    const index = joints.map((name) => {
      const i = canon.indexOf(name);
      if (i < 0) throw new Error(`${file}: joint ${name} not in the canonical skeleton`);
      return i;
    });
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
        cell = cellOf(tint && /Peasant_BaseColor/.test(uri) ? `${PEASANT_TEX}/${tint}.png` : dir + uri);
      }
      const corner = (i) => {
        const p = P.getElement(i, []);
        const n = N ? N.getElement(i, []) : [0, 1, 0];
        const j = J.getElement(i, []);
        const w = W.getElement(i, []);
        const sp = [0, 0, 0];
        const sn = [0, 0, 0];
        for (let k = 0; k < 4; k++) {
          if (w[k] <= 0) continue;
          const a = apply(bind[j[k]], p, 1);
          const b = apply(bind[j[k]], n, 0);
          for (let d = 0; d < 3; d++) {
            sp[d] += a[d] * w[k];
            sn[d] += b[d] * w[k];
          }
        }
        const len = Math.hypot(...sn) || 1;
        const sum = w.reduce((x, y) => x + y, 0) || 1;
        return { p: sp, n: sn.map((x) => x / len), uv: UV ? UV.getElement(i, []) : [0.5, 0.5], cell, c: factor.slice(0, 3), j: j.map((x) => index[x]), w: w.map((x) => x / sum), dominant: joints[j[w.indexOf(Math.max(...w))]] };
      };
      const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: P.getCount() }, (_, i) => i);
      const cache = new Map();
      const at = (i) => {
        if (!cache.has(i)) cache.set(i, corner(i));
        return cache.get(i);
      };
      for (let t = 0; t < idx.length; t += 3) {
        const tri = [at(idx[t]), at(idx[t + 1]), at(idx[t + 2])];
        if (keep(tri.map((x) => x.dominant))) out.push(...tri);
      }
    }
  }
  return out;
};

const HEAD = new Set(["neck_01", "Head"]);
const headOnly = (names) => names.every((n) => HEAD.has(n) || /eye|jaw|head|teeth|tongue/i.test(n));

await MeshoptSimplifier.ready;
const canonDoc = await io.read(`${OUTFITS}/Male_Peasant.gltf`);
const canon = canonDoc.getRoot().listSkins()[0].listJoints().map((j) => j.getName());
const canonRest = worldOf(canonDoc);
const restInverse = canon.map((name) => invert(canonRest.get(name)));
const animDoc = await io.read(ANIMS);
const animDoc2 = await io.read(ANIMS2);
// The library's mannequin stands on shorter legs: its hip translation is scaled to the outfit's.
const ualPelvis = worldOf(animDoc).get("pelvis")[13];
const hip = canonRest.get("pelvis")[13] / ualPelvis;

// --- clips: joint matrices per frame ---
const frames = [];
const clips = [];
for (const c of CLIPS) {
  const anim = (c.lib === 2 ? animDoc2 : animDoc).getRoot().listAnimations().find((a) => a.getName() === c.anim);
  if (!anim) throw new Error(`no animation ${c.anim}`);
  const length = Math.max(...anim.listSamplers().map((s) => s.getInput().getMax([])[0]));
  const count = Math.max(2, Math.round(length * FPS));
  clips.push({ name: c.name, from: frames.length / ((canon.length + 1) * 16), frames: count, seconds: length });
  for (let f = 0; f < count; f++) {
    const t = (f / count) * length;
    const pose = { rot: new Map(), pos: new Map() };
    for (const ch of anim.listChannels()) {
      const name = ch.getTargetNode().getName();
      if (ch.getTargetPath() === "rotation") pose.rot.set(name, sample(ch.getSampler(), t, 4));
      if (ch.getTargetPath() === "translation" && name === "pelvis") pose.pos.set(name, sample(ch.getSampler(), t, 3).map((x) => x * hip));
    }
    const world = worldOf(canonDoc, pose);
    for (let j = 0; j < canon.length; j++) frames.push(...mul(world.get(canon[j]), restInverse[j]));
    frames.push(...trs([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]));
  }
}

// --- figures ---
const built = [];
for (const f of FIGURES) {
  const corners = [
    ...(await bindTriangles(`${OUTFITS}/${f.outfit}.gltf`, canon, () => true, f.tint ?? null)),
    ...(await bindTriangles(`${BASE}/Superhero_Male_FullBody.gltf`, canon, headOnly)),
    ...(await Promise.all(f.hair.map((h) => bindTriangles(`${HAIR}/${h}.gltf`, canon)))).flat(),
  ];
  const key = new Map();
  const remap = [];
  const V = [];
  for (const v of corners) {
    const k = `${v.p.map((x) => x.toFixed(4))},${v.uv.map((x) => x.toFixed(4))},${v.cell}`;
    if (!key.has(k)) {
      key.set(k, V.length);
      V.push(v);
    }
    remap.push(key.get(k));
  }
  const positions = Float32Array.from(V.flatMap((v) => v.p));
  const target = Math.min(remap.length, Number(triangles) * 3);
  const [kept] = MeshoptSimplifier.simplify(Uint32Array.from(remap), positions, 3, target, 0.012, []);
  const used = new Map();
  const verts = [];
  const index = [];
  for (const i of kept) {
    if (!used.has(i)) {
      used.set(i, verts.length);
      verts.push(V[i]);
    }
    index.push(used.get(i));
  }
  built.push({ name: f.name, verts, index });
  console.log(`${f.name}: ${remap.length / 3} -> ${index.length / 3} triangles, ${verts.length} vertices`);
}

// --- atlas ---
const rows = Math.ceil(cells.length / COLS);
const atlasUv = (cell, u, v) => {
  const f = (x) => INSET + (((x % 1) + 1) % 1) * (1 - 2 * INSET);
  return [((cell % COLS) + f(u)) / COLS, (Math.floor(cell / COLS) + f(v)) / rows];
};
const composite = await Promise.all(cells.slice(1).map(async (path, k) => ({
  input: await sharp(readFileSync(path)).removeAlpha().resize(CELL, CELL, { fit: "fill" }).toBuffer(),
  left: ((k + 1) % COLS) * CELL,
  top: Math.floor((k + 1) / COLS) * CELL,
})));
const atlas = await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 3, background: "#ffffff" } }).composite(composite).jpeg({ quality: 86 }).toBuffer();

// --- the file ---
const chunks = [];
let offset = 0;
const add = (typed) => {
  const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const at = offset;
  chunks.push(bytes);
  offset += bytes.length;
  const pad = (4 - (offset % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    offset += pad;
  }
  return { offset: at, length: typed.length };
};
const header = {
  joints: canon.length,
  fps: FPS,
  clips,
  vat: add(Float32Array.from(frames)),
  figures: built.map((b) => ({
    name: b.name,
    position: add(Float32Array.from(b.verts.flatMap((v) => v.p))),
    normal: add(Float32Array.from(b.verts.flatMap((v) => v.n))),
    uv: add(Float32Array.from(b.verts.flatMap((v) => atlasUv(v.cell, v.uv[0], v.uv[1])))),
    color: add(Float32Array.from(b.verts.flatMap((v) => [...v.c, 1]))),
    joints: add(Uint8Array.from(b.verts.flatMap((v) => v.j))),
    weights: add(Float32Array.from(b.verts.flatMap((v) => v.w))),
    index: add(Uint16Array.from(b.index)),
  })),
  atlas: add(new Uint8Array(atlas)),
};
const json = Buffer.from(JSON.stringify(header));
const jsonPad = Buffer.alloc((4 - (json.length % 4)) % 4, 0x20);
const head = Buffer.alloc(12);
head.write("BCRW", 0, "ascii");
head.writeUInt32LE(1, 4);
head.writeUInt32LE(json.length + jsonPad.length, 8);
writeFileSync(out, Buffer.concat([head, json, jsonPad, ...chunks]));
console.log(`${out}: ${clips.map((c) => `${c.name} ${c.frames}`).join(", ")} frames; atlas ${COLS * CELL}x${rows * CELL}; ${(12 + json.length + offset) / 1e6} MB`);
