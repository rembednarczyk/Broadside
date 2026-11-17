import { type Vec3, add, dot, normalize, rotate, rotateInv, scale, sub, vec3 } from "@broadside/core";
import { type System } from "./context";
import { applyImpulseAt, pointVelocity } from "../physics/rigid-body";
import { type Entity } from "../world/components";
import { sectionIndex } from "../ship/ship-state";
import { sortedById } from "../world/world";

/**
 * Ship against ship. Each hull is a capsule on the water plane (a segment along the keel with a
 * radius of half the beam); overlapping capsules are pushed apart along the contact normal with
 * an impulse (restitution 0.2, Catto's sequential impulse for one contact) and both take damage
 * from the closing speed. A ship striking with her stem is ramming: her bow is built for it, so
 * she deals more and takes less.
 */
const RESTITUTION = 0.2;
const DAMAGE_PER_MS = 22;

interface Capsule {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly r: number;
}

const capsule = (e: Entity): Capsule => {
  const h = e.ship!.model.def.hull;
  const half = h.length * 0.42;
  const c = e.body!.pos;
  const ax = rotate(e.body!.rot, vec3(0, 0, half));
  return { a: vec3(c.x - ax.x, 0, c.z - ax.z), b: vec3(c.x + ax.x, 0, c.z + ax.z), r: h.beam * 0.45 };
};

/** Closest points between two segments (Ericson, "Real-Time Collision Detection", 5.1.9). */
const closest = (p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): [Vec3, Vec3] => {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  const c = dot(d1, r);
  const b = dot(d1, d2);
  const den = a * e - b * b;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = Math.min(1, Math.max(0, -c / a));
  } else if (t > 1) {
    t = 1;
    s = Math.min(1, Math.max(0, (b - c) / a));
  }
  return [add(p1, scale(d1, s)), add(p2, scale(d2, t))];
};

const hurt = (e: Entity, at: Vec3, amount: number): void => {
  const s = e.ship!;
  const local = rotateInv(e.body!.rot, sub(at, e.body!.pos));
  const L = s.model.def.hull.length;
  const zone = local.z > L / 6 ? 0 : local.z < -L / 6 ? 2 : 1;
  const sec = s.sections[sectionIndex(zone, local.x > 0)]!;
  sec.hp = Math.max(0, sec.hp - amount);
  sec.leak += amount * 0.0012;
};

export const collisionSystem: System = (ctx) => {
  const ships = sortedById(ctx.world.with("ship", "body")).filter((e) => !e.ship.sinking || e.ship.sunkFor < 10);
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const A = ships[i]!;
      const B = ships[j]!;
      const reach = (A.ship!.model.def.hull.length + B.ship!.model.def.hull.length) * 0.6;
      if (Math.abs(A.body!.pos.x - B.body!.pos.x) > reach || Math.abs(A.body!.pos.z - B.body!.pos.z) > reach) continue;
      const ca = capsule(A);
      const cb = capsule(B);
      const [pa, pb] = closest(ca.a, ca.b, cb.a, cb.b);
      const d = sub(pb, pa);
      const dist = Math.hypot(d.x, d.z);
      const depth = ca.r + cb.r - dist;
      if (depth <= 0) continue;
      const n = dist > 1e-6 ? normalize(vec3(d.x, 0, d.z)) : vec3(1, 0, 0);
      const contact = add(pa, scale(n, ca.r - depth / 2));
      const at = vec3(contact.x, A.body!.pos.y, contact.z);
      const va = pointVelocity(A.body!, at);
      const vb = pointVelocity(B.body!, at);
      const closing = dot(sub(va, vb), n);
      // Positional correction: separate the hulls (split by mass).
      const ma = A.body!.mass;
      const mb = B.body!.mass;
      A.body!.pos = sub(A.body!.pos, scale(n, (depth * mb) / (ma + mb)));
      B.body!.pos = add(B.body!.pos, scale(n, (depth * ma) / (ma + mb)));
      if (closing <= 0) continue;
      const impulse = ((1 + RESTITUTION) * closing) / (1 / ma + 1 / mb);
      applyImpulseAt(A.body!, scale(n, -impulse), at);
      applyImpulseAt(B.body!, scale(n, impulse), at);
      // Ramming: the striker's stem points along the contact normal.
      const bowA = dot(rotate(A.body!.rot, vec3(0, 0, 1)), n);
      const bowB = -dot(rotate(B.body!.rot, vec3(0, 0, 1)), n);
      const ramA = bowA > 0.75 && rotateInv(A.body!.rot, va).z > 1.5;
      const ramB = bowB > 0.75 && rotateInv(B.body!.rot, vb).z > 1.5;
      const base = closing * closing * DAMAGE_PER_MS * Math.sqrt((ma * mb) / (ma + mb) / 1e5);
      hurt(A, at, base * (ramA ? 0.4 : ramB ? 1.8 : 1));
      hurt(B, at, base * (ramB ? 0.4 : ramA ? 1.8 : 1));
      if (ramA) B.ship!.lastHitBy = A.id;
      if (ramB) A.ship!.lastHitBy = B.id;
      if (closing > 0.6) ctx.events.push({ type: "collision", a: A.id, b: B.id, at, speed: closing, ram: ramA || ramB });
    }
  }
};
