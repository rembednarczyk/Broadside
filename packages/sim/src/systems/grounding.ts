import { type Vec3, rotateInv, terrainHeight, vec3 } from "@broadside/core";
import { type System } from "./context";
import { type RigidBody, applyForceAt, bodyToWorld, pointVelocity } from "../physics/rigid-body";
import { type ShipModel } from "../ship/ship-model";
import { type ShipState, crewShare, sectionIndex } from "../ship/ship-state";
import { type SimContext } from "./context";

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

/**
 * Kedging off: a ship hard aground and nearly stopped has her boats carry an anchor out to deep
 * water and the crew heave her towards it at the capstan (period seamanship). Modelled as a small
 * pull towards the deepest water around her, scaled by the crew left aboard.
 */
const KEDGE_ACCEL = 0.06;
const kedge = (a: NonNullable<SimContext["env"]["archipelago"]>, b: RigidBody, s: ShipState): void => {
  let best = { x: 0, z: 0, depth: Infinity };
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2;
    const x = Math.sin(ang);
    const z = Math.cos(ang);
    const depth = terrainHeight(a, b.pos.x + x * 60, b.pos.z + z * 60);
    if (depth < best.depth) best = { x, z, depth };
  }
  const pull = b.mass * KEDGE_ACCEL * Math.min(1, crewShare(s) * 1.5);
  applyForceAt(b, vec3(best.x * pull, 0, best.z * pull), b.pos);
};

export const groundingSystem: System = (ctx, dt) => {
  const a = ctx.env.archipelago;
  if (!a) return;
  for (const e of ctx.world.with("ship", "body")) {
    const b = e.body;
    const s = e.ship;
    const pts = keelOf(s.model);
    const stiffness = (b.mass * 9.81 * 3) / (s.model.def.hull.draft * KEEL_POINTS);
    let touching = false;
    for (const [i, local] of pts.entries()) {
      const wp = bodyToWorld(b, local);
      const bed = terrainHeight(a, wp.x, wp.z);
      const depth = bed - wp.y;
      if (depth <= 0) continue;
      touching = true;
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
    s.aground = touching;
    // An AI ship hard on the bottom takes in all sail: canvas drawing against a ship pinned by her
    // keel heels her over until she lies on her beam (a frigate capsized on a bank without a shot
    // fired, playtest audit 20.11). The player's crew leave the canvas to the player.
    if (touching && !s.sinking && e.captain && Math.hypot(b.vel.x, b.vel.z) < 1.5) s.sailTarget = s.sailTarget.map(() => 0);
    if (touching && !s.sinking && Math.hypot(b.vel.x, b.vel.z) < 0.4) kedge(a, b, s);
  }
};
