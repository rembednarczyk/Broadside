import { type PartFault, type PartKind, type PartVolume, type ShipPart, type Vec, partId } from "./parts";

/**
 * Bounding volumes of a ship's parts and the rule that they do not run through one another
 * (`auditClashes`): a gun does not stand in a wall without a port, a shroud or a stay does not pass
 * through the castle, a yard does not cross another mast. The volumes are the usual pair of
 * collision detection (Ericson, "Real-Time Collision Detection", 2005, ch. 4-5): capsules for the
 * long round parts (spars, guns, ropes), axis-aligned boxes in hull space for the built ones.
 * Capsule against capsule is the exact distance between two segments (§5.1.9); capsule against box
 * is taken at 17 points along the capsule's axis, which is exact enough for parts metres long
 * against boxes metres wide and keeps the rule a few lines.
 */
const sub = (p: Vec, q: Vec): Vec => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: Vec, q: Vec): number => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const along = (p: Vec, d: Vec, t: number): Vec => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/** Least distance between the segments p1-q1 and p2-q2. */
export const segmentDistance = (p1: Vec, q1: Vec, p2: Vec, q2: Vec): number => {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s = 0;
  let t = 0;
  if (a > 1e-12 && e > 1e-12) {
    const b = dot(d1, d2);
    const c = dot(d1, r);
    const den = a * e - b * b;
    s = den > 1e-12 ? clamp01((b * f - c * e) / den) : 0;
    t = (b * s + f) / e;
    if (t < 0) {
      t = 0;
      s = clamp01(-c / a);
    } else if (t > 1) {
      t = 1;
      s = clamp01((b - c) / a);
    }
  } else if (a > 1e-12) s = clamp01(-dot(d1, r) / a);
  else if (e > 1e-12) t = clamp01(f / e);
  const gap = sub(along(p1, d1, s), along(p2, d2, t));
  return Math.sqrt(dot(gap, gap));
};

/** Distance from a point to an axis-aligned box (0 inside). */
export const boxDistance = (p: Vec, min: Vec, max: Vec): number => {
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const d = Math.max(min[i]! - p[i]!, 0, p[i]! - max[i]!);
    sum += d * d;
  }
  return Math.sqrt(sum);
};

const SAMPLES = 16;

/** How far two volumes are apart (negative or zero: they run through one another). */
export const volumeGap = (u: PartVolume, v: PartVolume): number => {
  if (u.shape === "capsule" && v.shape === "capsule") return segmentDistance(u.a, u.b, v.a, v.b) - u.r - v.r;
  if (u.shape === "box" && v.shape === "box") {
    let gap = -Infinity;
    for (let i = 0; i < 3; i++) gap = Math.max(gap, u.min[i]! - v.max[i]!, v.min[i]! - u.max[i]!);
    return gap;
  }
  const capsule = u.shape === "capsule" ? u : (v as Extract<PartVolume, { shape: "capsule" }>);
  const box = u.shape === "box" ? u : (v as Extract<PartVolume, { shape: "box" }>);
  const d = sub(capsule.b, capsule.a);
  let least = Infinity;
  for (let i = 0; i <= SAMPLES; i++) least = Math.min(least, boxDistance(along(capsule.a, d, i / SAMPLES), box.min, box.max));
  return least - capsule.r;
};

/** Kinds of part that must not run through one another. */
export const CLASHING: readonly (readonly [PartKind, PartKind])[] = [
  ["gun", "castle"],
  ["shroud", "castle"],
  ["stay", "castle"],
  ["yard", "mast"],
  ["gun", "mast"],
];

/**
 * The parts that run through one another against the rule (`clash`, named "a|b"). A part carried
 * by the other is not a clash (a yard is slung on its mast), and a gun in the castle is let be
 * where the castle has a port for it (a part `port:<gun's index>`).
 */
export const auditClashes = (parts: readonly ShipPart[]): PartFault[] => {
  const faults: PartFault[] = [];
  const ids = new Set(parts.map((p) => p.id));
  for (const [ka, kb] of CLASHING) {
    for (const p of parts) {
      if (p.kind !== ka || !p.volumes) continue;
      for (const q of parts) {
        if (q.kind !== kb || !q.volumes || p.on === q.id || q.on === p.id) continue;
        if (ka === "gun" && kb === "castle" && ids.has(partId("port", p.id.split(":")[1]!))) continue;
        if (p.volumes.some((u) => q.volumes!.some((v) => volumeGap(u, v) < 0))) faults.push({ fault: "clash", part: `${p.id}|${q.id}` });
      }
    }
  }
  return faults;
};
