/**
 * Retargeting of a Mixamo clip (sampled by fbx-anim.mjs) onto the figures' skeleton (Quaternius's
 * UE-style rig, crew-anim.mjs). The method of three.js's SkeletonUtils.retarget and of most game
 * retargeters ("world-space delta"): each source bone's rotation away from its rest pose, taken in
 * world space, is applied to the matching target bone's rest. The two rigs stand differently at
 * rest (Mixamo in a T-pose, the figures in their own), so each target bone is first turned to point
 * where the source bone points at rest (its direction to the first matched child; twist is left
 * alone, which is where this falls short of a full retargeter, e.g. Autodesk HumanIK). Both rigs'
 * frames (up: pelvis to head; left: right thigh to left thigh) give the rotation between their
 * worlds, the clip is turned to face the figures' forward at its first frame, and the hips'
 * travel is scaled by the ratio of leg lengths.
 *
 * A looped clip (climbing a ladder or a rope) has its climb taken out: the steady rise over a cycle
 * is subtracted, so the man climbs in place and the game moves him at `rise / seconds`.
 */
import { apply, invert, worldOf } from "./skeleton.mjs";

/** Target joint -> Mixamo bone. */
export const MIXAMO = (() => {
  const map = { pelvis: "Hips", spine_01: "Spine", spine_02: "Spine1", spine_03: "Spine2", neck_01: "Neck", Head: "Head" };
  for (const [s, side] of [["l", "Left"], ["r", "Right"]]) {
    Object.assign(map, {
      [`clavicle_${s}`]: `${side}Shoulder`, [`upperarm_${s}`]: `${side}Arm`, [`lowerarm_${s}`]: `${side}ForeArm`, [`hand_${s}`]: `${side}Hand`,
      [`thigh_${s}`]: `${side}UpLeg`, [`calf_${s}`]: `${side}Leg`, [`foot_${s}`]: `${side}Foot`, [`ball_${s}`]: `${side}ToeBase`,
    });
    for (const [f, F] of [["thumb", "Thumb"], ["index", "Index"], ["middle", "Middle"], ["ring", "Ring"], ["pinky", "Pinky"]]) {
      for (let k = 1; k <= 3; k++) map[`${f}_0${k}_${s}`] = `${side}Hand${F}${k}`;
    }
  }
  return map;
})();

// --- vectors and quaternions [x, y, z, w] ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => scale(a, 1 / Math.hypot(...a));
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => qmul(qmul(q, [...v, 0]), qinv(q)).slice(0, 3);
const qaxis = (axis, angle) => [...scale(norm(axis), Math.sin(angle / 2)), Math.cos(angle / 2)];
/** Shortest rotation taking unit vector a onto unit vector b. */
const qbetween = (a, b) => {
  const c = cross(a, b);
  const w = 1 + dot(a, b);
  if (w < 1e-6) return qaxis(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]), Math.PI);
  const n = Math.hypot(...c, w);
  return [c[0] / n, c[1] / n, c[2] / n, w / n];
};
/** Rotation of a matrix with its scale divided out (Shepperd's method). */
const qfromMatrix = (m) => {
  const cols = [0, 4, 8].map((o) => norm([m[o], m[o + 1], m[o + 2]]));
  const [m00, m10, m20] = cols[0];
  const [m01, m11, m21] = cols[1];
  const [m02, m12, m22] = cols[2];
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
};
/** Rotation taking frame (lat, up, fwd) of one rig onto another's. */
const frameOf = (pos) => {
  const up = norm(sub(pos.head, pos.pelvis));
  const raw = sub(pos.left, pos.right);
  const lat = norm(sub(raw, scale(up, dot(raw, up))));
  return { up, lat, fwd: cross(lat, up) };
};
const qbetweenFrames = (from, to) => {
  const q1 = qbetween(from.up, to.up);
  const lat = qrot(q1, from.lat);
  const angle = Math.atan2(dot(cross(lat, to.lat), to.up), dot(lat, to.lat));
  return qmul(qaxis(to.up, angle), q1);
};

/**
 * Local pose of every target joint per frame (rot: joint -> quaternion; pos: pelvis translation),
 * for crew-anim's `worldOf`, plus the clip's travel in the target's units: `rise` (up) and
 * `advance` (forward) over the clip, and `reach`, how far before the man his hands are (the
 * rungs of a ladder). `canonDoc`: the target rig's document; `canonRest`: its rest world
 * matrices by node name; `loop`: take the steady travel out.
 */
export const retarget = (src, canonDoc, canonRest, loop) => {
  const joints = canonDoc.getRoot().listSkins()[0].listJoints();
  const TP = (name) => canonRest.get(name).slice(12, 15);
  const TR = (name) => qfromMatrix(canonRest.get(name));
  const SP = (b) => src.rest[b].slice(4, 7);
  const SR = (b) => src.rest[b].slice(0, 4);
  const tFrame = frameOf({ head: TP("Head"), pelvis: TP("pelvis"), left: TP("thigh_l"), right: TP("thigh_r") });
  const sFrame = frameOf({ head: SP("Head"), pelvis: SP("Hips"), left: SP("LeftUpLeg"), right: SP("RightUpLeg") });
  const G = qbetweenFrames(sFrame, tFrame);
  // Face the figures' forward at the first frame: the hips' heading turned about the source's up.
  const F0 = src.frames[0];
  const heading = qrot(qmul(F0.Hips.slice(0, 4), qinv(SR("Hips"))), sFrame.fwd);
  const flat = sub(heading, scale(sFrame.up, dot(heading, sFrame.up)));
  const Y = qaxis(sFrame.up, -Math.atan2(dot(cross(sFrame.fwd, flat), sFrame.up), dot(sFrame.fwd, flat)));
  const leg = (P, a, b, c) => Math.hypot(...sub(P(a), P(b))) + Math.hypot(...sub(P(b), P(c)));
  const k = leg(TP, "thigh_l", "calf_l", "foot_l") / leg(SP, "LeftUpLeg", "LeftLeg", "LeftFoot");
  // Each matched joint turned to point, at rest, where its source bone points.
  const align = new Map();
  for (const j of joints) {
    const name = j.getName();
    const b = MIXAMO[name];
    if (!b) continue;
    const child = j.listChildren().find((c) => MIXAMO[c.getName()]);
    const parentAlign = align.get(j.getParentNode()?.getName()) ?? [0, 0, 0, 1];
    if (!child) {
      align.set(name, parentAlign);
      continue;
    }
    const dt = norm(sub(TP(child.getName()), TP(name)));
    const ds = norm(qrot(G, sub(SP(MIXAMO[child.getName()]), SP(b))));
    align.set(name, qbetween(dt, ds));
  }
  const last = src.frames.length - 1;
  const hips = (f) => src.frames[f].Hips.slice(4, 7);
  const travel = sub(hips(last), hips(0));
  // Source travel brought into the target's frame and units.
  const toTarget = (v) => scale(qrot(G, qrot(Y, v)), k);
  const parentOfPelvis = joints.find((j) => j.getName() === "pelvis").getParentNode().getName();
  const intoParent = invert(canonRest.get(parentOfPelvis));
  const poses = [];
  for (let f = 0; f < (loop ? last : last + 1); f++) {
    const F = src.frames[f];
    const world = new Map();
    const rot = new Map();
    for (const j of joints) {
      const name = j.getName();
      const parent = j.getParentNode();
      const pw = world.get(parent?.getName()) ?? (parent ? TR(parent.getName()) : [0, 0, 0, 1]);
      const b = MIXAMO[name];
      const w = b ? qmul(qmul(qmul(G, qmul(qmul(Y, F[b].slice(0, 4)), qinv(SR(b)))), qinv(G)), qmul(align.get(name), TR(name))) : qmul(pw, j.getRotation());
      world.set(name, w);
      rot.set(name, qmul(qinv(pw), w));
    }
    const drift = loop ? scale(travel, f / last) : [0, 0, 0];
    const at = add(TP("pelvis"), toTarget(sub(sub(hips(f), hips(0)), drift)));
    poses.push({ rot, pos: new Map([["pelvis", apply(intoParent, at, 1)]]) });
  }
  // The lower foot of the first frame on the ground of the rest pose (the rung he stands on).
  const posed = (f) => worldOf(canonDoc, poses[f]);
  const first = posed(0);
  const restFoot = Math.min(dot(TP("foot_l"), tFrame.up), dot(TP("foot_r"), tFrame.up));
  const lift = restFoot - Math.min(...["foot_l", "foot_r"].map((n) => dot(first.get(n).slice(12, 15), tFrame.up)));
  const shift = apply(intoParent, scale(tFrame.up, lift), 0);
  for (const p of poses) p.pos.set("pelvis", add(p.pos.get("pelvis"), shift));
  // How far before him his hands work, on average over the clip.
  const origin = TP("pelvis");
  let reach = 0;
  for (let f = 0; f < poses.length; f++) {
    const w = posed(f);
    const hands = scale(add(w.get("hand_l").slice(12, 15), w.get("hand_r").slice(12, 15)), 0.5);
    reach += dot(sub(hands, origin), tFrame.fwd) / poses.length;
  }
  const t = toTarget(travel);
  return { poses, seconds: src.seconds, rise: dot(t, tFrame.up), advance: dot(t, tFrame.fwd), reach };
};
