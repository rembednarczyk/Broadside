#!/usr/bin/env node
/**
 * An animation from an FBX file (Mixamo's rig) as plain data for the crew bake (crew-anim.mjs):
 * the world rotation and position of every bone in the rest pose and in each sampled frame. The
 * file is read by three.js's FBXLoader and played by its AnimationMixer (pure JS, no converter
 * binary); retargeting onto the figures' skeleton is crew-anim's job, so this only samples.
 *
 * Output JSON: { fps, seconds, bones: { name: parent }, rest: { name: [qx,qy,qz,qw, px,py,pz] },
 * frames: [ { name: [...] } ] }, bone names without the "mixamorig" prefix, positions in the file's
 * units (Mixamo: centimetres), Y up.
 *
 * Usage: node tools/assets/fbx-anim.mjs <in.fbx> <out.json> [fps=15]
 */
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { AnimationMixer, LoopOnce, Quaternion, Vector3 } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const [input, out, fpsArg = "15"] = process.argv.slice(2);
if (!input || !out) {
  console.error("usage: fbx-anim.mjs <in.fbx> <out.json> [fps=15]");
  process.exit(1);
}
const FPS = Number(fpsArg);
const buf = readFileSync(input);
// FBXLoader warns about features it skips (materials of the preview mesh); the bones are all we read.
const warn = console.warn;
console.warn = () => {};
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
console.warn = warn;
const clip = root.animations.find((a) => a.tracks.length > 0);
if (!clip) throw new Error(`${input}: no animation`);

const bones = [];
root.traverse((o) => {
  if (o.isBone) bones.push(o);
});
const short = (name) => name.replace(/^mixamorig:?/, "");
const snapshot = () => {
  root.updateMatrixWorld(true);
  const q = new Quaternion();
  const p = new Vector3();
  return Object.fromEntries(bones.map((b) => [short(b.name), [...b.getWorldQuaternion(q).toArray(), ...b.getWorldPosition(p).toArray()].map((x) => Number(x.toFixed(6)))]));
};

const rest = snapshot();
const mixer = new AnimationMixer(root);
// Played once and held at its end, so the last sample is the last frame (a looping action wraps to the first).
const action = mixer.clipAction(clip);
action.setLoop(LoopOnce, 1);
action.clampWhenFinished = true;
action.play();
const count = Math.max(2, Math.round(clip.duration * FPS));
const frames = [];
for (let f = 0; f <= count; f++) {
  mixer.setTime((f / count) * clip.duration);
  frames.push(snapshot());
}
const parents = Object.fromEntries(bones.map((b) => [short(b.name), b.parent?.isBone ? short(b.parent.name) : null]));
writeFileSync(out, JSON.stringify({ fps: FPS, seconds: clip.duration, bones: parents, rest, frames }));
console.log(`${input}: ${bones.length} bones, ${clip.duration.toFixed(2)} s, ${frames.length} frames`);
