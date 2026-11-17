import { type Vec3, halfBreadth, rotateInv, sub, vec3 } from "@broadside/core";
import { type RigidBody } from "../physics/rigid-body";
import { type ShipModel } from "../ship/ship-model";

/**
 * Segment against a ship: a slab test (Kay and Kajiya 1986) against the hull's bounding box and
 * the rig's box in body space, refined for the hull by marching to the first point inside the
 * real lines (half-breadth at that station and height). Returns the hull-space point (origin at
 * the waterline) of the first contact.
 */
export interface HitResult {
  readonly t: number;
  /** Hull space: x starboard, y above the waterline, z towards the bow. */
  readonly local: Vec3;
  readonly where: "hull" | "rig";
}

const BULWARK = 0.9;

const slab = (o: Vec3, d: Vec3, min: Vec3, max: Vec3): number | null => {
  let t0 = 0;
  let t1 = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const inv = 1 / (d[axis] || 1e-12);
    let a = (min[axis] - o[axis]) * inv;
    let b = (max[axis] - o[axis]) * inv;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
};

export interface RigBox {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** Bounding box of the masts and sails in hull space. */
export const rigBox = (m: ShipModel): RigBox => {
  const h = m.def.hull;
  const zs = m.def.masts.map((x) => x.z);
  const top = Math.max(...m.def.masts.map((x) => x.height)) + h.freeboard;
  const yard = Math.max(...m.def.masts.map((x) => x.height)) * 0.45;
  return { min: vec3(-yard, h.freeboard + h.sheer + BULWARK, Math.min(...zs) - h.length * 0.22), max: vec3(yard, top, Math.max(...zs) + h.length * 0.22) };
};

const insideHull = (m: ShipModel, p: Vec3): boolean => {
  const h = m.def.hull;
  const u = p.z / h.length + 0.5;
  if (u < 0 || u > 1) return false;
  return Math.abs(p.x) <= halfBreadth(h, u, Math.min(p.y, h.freeboard + h.sheer - 1e-3)) + (p.y > h.freeboard ? 0.2 : 0);
};

export const segmentHit = (b: RigidBody, m: ShipModel, rig: RigBox, from: Vec3, to: Vec3): HitResult | null => {
  // Into hull space: body space plus the centre of mass offset.
  const toHull = (p: Vec3): Vec3 => {
    const l = rotateInv(b.rot, sub(p, b.pos));
    return vec3(l.x + m.com.x, l.y + m.com.y, l.z + m.com.z);
  };
  const o = toHull(from);
  const e = toHull(to);
  const d = sub(e, o);
  const h = m.def.hull;
  const hullMin = vec3(-h.beam / 2, -h.draft, -h.length / 2);
  const hullMax = vec3(h.beam / 2, h.freeboard + h.sheer + BULWARK, h.length / 2);
  const th = slab(o, d, hullMin, hullMax);
  if (th !== null) {
    for (let i = 0; i <= 10; i++) {
      const t = th + ((1 - th) * i) / 10;
      const p = vec3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
      if (insideHull(m, p)) return { t, local: p, where: "hull" };
    }
  }
  const tr = slab(o, d, rig.min, rig.max);
  if (tr !== null) return { t: tr, local: vec3(o.x + d.x * tr, o.y + d.y * tr, o.z + d.z * tr), where: "rig" };
  return null;
};
