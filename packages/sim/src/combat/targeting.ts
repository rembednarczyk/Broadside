import { wrapAngle, yawOf } from "@broadside/core";
import { type Entity } from "../world/components";
import { hostileTo } from "../ai/captain";

/**
 * Target selection for a battery (aim assist for the player, the same rule an AI gun captain
 * uses): the nearest hostile ship inside the battery's arc and range, with its position led by
 * the shot's time of flight. Returns the aim range and the world bearing.
 */
export interface Aim {
  readonly target: Entity;
  readonly range: number;
  readonly bearing: number;
}

const ARCS: Readonly<Record<string, { readonly centre: number; readonly half: number; readonly max: number }>> = {
  port: { centre: -Math.PI / 2, half: 0.7, max: 460 },
  starboard: { centre: Math.PI / 2, half: 0.7, max: 460 },
  bowChaser: { centre: 0, half: 0.6, max: 450 },
  sternChaser: { centre: Math.PI, half: 0.6, max: 420 },
  mortar: { centre: 0, half: Math.PI, max: 800 },
  swivel: { centre: 0, half: Math.PI, max: 160 },
};

export const aimFor = (me: Entity, ships: readonly Entity[], arc: keyof typeof ARCS, hostileOnly = true): Aim | null => {
  const a = ARCS[arc]!;
  const b = me.body!;
  const heading = yawOf(b.rot);
  let best: Aim | null = null;
  for (const o of ships) {
    if (o.id === me.id || o.ship!.sinking) continue;
    if (hostileOnly && !hostileTo(me.ship!, o.ship!) && o.ship!.lastHitBy !== me.id) continue;
    const tb = o.body!;
    const r0 = Math.hypot(tb.pos.x - b.pos.x, tb.pos.z - b.pos.z);
    const tof = r0 / 95;
    const px = tb.pos.x + tb.vel.x * tof;
    const pz = tb.pos.z + tb.vel.z * tof;
    const range = Math.hypot(px - b.pos.x, pz - b.pos.z);
    const bearing = Math.atan2(px - b.pos.x, pz - b.pos.z);
    if (range > a.max || Math.abs(wrapAngle(bearing - heading - a.centre)) > a.half) continue;
    if (!best || range < best.range) best = { target: o, range, bearing };
  }
  return best;
};
