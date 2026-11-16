import { type Vec3, approach, rotate, rotateInv, sailForce, vec3 } from "@broadside/core";
import { type System } from "./context";
import { applyForceAt, bodyToWorld, pointVelocity } from "../physics/rigid-body";
import { type ShipState, crewShare, setFactor } from "../ship/ship-state";
import { windAt } from "../environment/environment";
import { type MastModel } from "../ship/ship-model";

/**
 * Sail handling and sail forces. Setting or taking in sail takes time that grows with the sail
 * area and shrinks with the hands available and the rigging condition. Each mast reports its
 * force; a mast loaded past its strength is damaged and can go by the board.
 */
const HANDLING_RATE = 0.25;
/** Damage per second per unit of overload (force / strength - 1). */
const OVERLOAD_DAMAGE = 0.5;

const studdingOf = (m: MastModel): boolean => m.sails.some((s) => s.studding);

const handleSails = (s: ShipState, dt: number): void => {
  const handsShare = Math.max(0.15, crewShare(s)) * (0.35 + 0.65 * s.rigging);
  s.model.masts.forEach((m, i) => {
    if (s.mastHp[i]! <= 0) {
      s.sailSet[i] = 0;
      return;
    }
    const target = setFactor(s.sailTarget[i]!, studdingOf(m));
    const areaFactor = 400 / (400 + m.sails.reduce((a, x) => a + x.area, 0));
    s.sailSet[i] = approach(s.sailSet[i]!, target, HANDLING_RATE * handsShare * (0.5 + areaFactor) * dt);
  });
};

export const sailSystem: System = (ctx, dt) => {
  for (const e of ctx.world.with("ship", "body")) {
    const s = e.ship;
    const b = e.body;
    if (s.sinking) continue;
    handleSails(s, dt);
    const trim = Math.min(1, crewShare(s) * 1.2) * (0.4 + 0.6 * s.rigging);
    s.model.masts.forEach((m, i) => {
      if (s.mastHp[i]! <= 0 || s.sailSet[i]! <= 0) return;
      let total: Vec3 = vec3(0, 0, 0);
      for (const sail of m.sails) {
        const ceWorld = bodyToWorld(b, sail.ce);
        const tw = windAt(ctx.env, ceWorld.y);
        const pv = pointVelocity(b, ceWorld);
        const local = rotateInv(b.rot, vec3(tw.x - pv.x, 0, tw.z - pv.z));
        const area = sail.area * s.sailSet[i]! * (0.3 + 0.7 * s.sailCloth[i]!);
        const f = sailForce(sail.rig, area, local.x, local.z, trim);
        const world = rotate(b.rot, vec3(f.fx, 0, f.fz));
        applyForceAt(b, world, ceWorld);
        total = vec3(total.x + world.x, total.y + world.y, total.z + world.z);
      }
      const load = Math.hypot(total.x, total.z) / m.strength;
      if (load > 1) s.mastHp[i] = Math.max(0, s.mastHp[i]! - (load - 1) * OVERLOAD_DAMAGE * s.model.def.mastHp * dt * 0.1);
      if (s.mastHp[i]! <= 0) {
        s.sailSet[i] = 0;
        ctx.events.push({ type: "mastFell", ship: e.id, mast: i });
      }
    });
  }
};
