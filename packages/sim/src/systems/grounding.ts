import { type Vec3, rotateInv, terrainHeight, vec3 } from "@broadside/core";
import { type System } from "./context";
import { applyForceAt, bodyToWorld, pointVelocity } from "../physics/rigid-body";
import { type ShipModel } from "../ship/ship-model";
import { sectionIndex } from "../ship/ship-state";

/**
 * Running aground. Points along the keel are checked against the seabed; a point below the bed is
 * pushed up by a penalty spring with damping (the usual soft-contact model of game physics) and
 * dragged by friction along the bottom. Grinding fast over the bottom holes the planking of that
 * section, more the longer and faster it goes on.
 */
const KEEL_POINTS = 7;
const FRICTION = 0.6;
/** Contact speed (m/s) above which the bottom is holed. */
const HOLE_SPEED = 1.2;
/** Leak (m³/s per (m/s)²) and planking lost (hp per m) while grinding at a keel point. */
const GRIND_LEAK = 0.015;
const GRIND_HP = 12;

const keel = new Map<ShipModel, Vec3[]>();
const keelOf = (m: ShipModel): Vec3[] => {
  let k = keel.get(m);
  if (!k) {
    const h = m.def.hull;
    k = Array.from({ length: KEEL_POINTS }, (_, i) => vec3(0, -h.draft * 0.95 - m.com.y, h.length * (-0.45 + (0.9 * i) / (KEEL_POINTS - 1)) - m.com.z));
    keel.set(m, k);
  }
  return k;
};

export const groundingSystem: System = (ctx, dt) => {
  const a = ctx.env.archipelago;
  if (!a) return;
  for (const e of ctx.world.with("ship", "body")) {
    const b = e.body;
    const s = e.ship;
    const pts = keelOf(s.model);
    const stiffness = (b.mass * 9.81 * 3) / (s.model.def.hull.draft * KEEL_POINTS);
    for (const [i, local] of pts.entries()) {
      const wp = bodyToWorld(b, local);
      const bed = terrainHeight(a, wp.x, wp.z);
      const depth = bed - wp.y;
      if (depth <= 0) continue;
      const v = pointVelocity(b, wp);
      const up = stiffness * depth - (b.mass / KEEL_POINTS) * 2 * Math.min(0, v.y);
      applyForceAt(b, vec3(-v.x * (b.mass / KEEL_POINTS) * FRICTION, Math.max(0, up), -v.z * (b.mass / KEEL_POINTS) * FRICTION), wp);
      const speed = Math.hypot(v.x, v.z);
      if (speed > HOLE_SPEED) {
        const zone = i < 2 ? 2 : i > 4 ? 0 : 1;
        const sec = s.sections[sectionIndex(zone as 0 | 1 | 2, rotateInv(b.rot, v).x > 0)]!;
        // Damage grows with the time the keel grinds on the bottom (per second, not per step).
        sec.leak += GRIND_LEAK * speed * speed * dt;
        sec.hp = Math.max(0, sec.hp - GRIND_HP * speed * dt);
        // Report the grinding a few times a second (sound and spray), not every step.
        const t = ctx.env.time;
        if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) ctx.events.push({ type: "grounded", ship: e.id, at: wp, speed });
      }
    }
  }
};
