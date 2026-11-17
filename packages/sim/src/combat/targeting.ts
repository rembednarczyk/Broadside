import { wrapAngle, yawOf } from "@broadside/core";
import { type Entity } from "../world/components";
import { hostileTo } from "../ai/captain";
import { type Relations, isHostile, standing } from "@broadside/core";

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

export const aimFor = (me: Entity, ships: readonly Entity[], arc: keyof typeof ARCS, hostileOnly = true, rel: Relations | null = null): Aim | null => {
  const a = ARCS[arc]!;
  const b = me.body!;
  const heading = yawOf(b.rot);
  let best: Aim | null = null;
  for (const o of ships) {
    if (o.id === me.id || o.ship!.sinking) continue;
    if (hostileOnly && !hostileTo(me.ship!, o.ship!, rel) && o.ship!.lastHitBy !== me.id) continue;
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

/** A fort in a battery's arc: range, bearing and the height of its walls' middle. */
export interface FortAim {
  readonly fort: Entity;
  readonly range: number;
  readonly bearing: number;
  readonly aimHeight: number;
}

export const aimForFort = (me: Entity, forts: readonly Entity[], arc: keyof typeof ARCS, rel: Relations | null = null): FortAim | null => {
  const a = ARCS[arc]!;
  const b = me.body!;
  const heading = yawOf(b.rot);
  let best: FortAim | null = null;
  for (const f of forts) {
    const st = f.fort!;
    if (st.silenced) continue;
    if (st.provokedBy !== me.id && !isHostile(standing(me.ship!.faction, st.faction, rel))) continue;
    const range = Math.hypot(st.site.x - b.pos.x, st.site.z - b.pos.z) - st.def.radius * 0.5;
    const bearing = Math.atan2(st.site.x - b.pos.x, st.site.z - b.pos.z);
    if (range > a.max || Math.abs(wrapAngle(bearing - heading - a.centre)) > a.half) continue;
    if (!best || range < best.range) best = { fort: f, range, bearing, aimHeight: st.site.y + st.def.height * 0.5 };
  }
  return best;
};

/** The nearest silenced fort that is not ours, within reach of a landing party. */
export const fortToStorm = (me: Entity, forts: readonly Entity[]): Entity | null => {
  const b = me.body!;
  for (const f of forts) {
    const st = f.fort!;
    if (!st.silenced || st.faction === me.ship!.faction) continue;
    if (Math.hypot(st.site.x - b.pos.x, st.site.z - b.pos.z) < st.def.radius + 200) return f;
  }
  return null;
};
