import { type Doctrine, wrapAngle, yawOf } from "@broadside/core";
import { type Entity } from "../world/components";

/**
 * Manoeuvres of a captain's doctrine (core/data/doctrines) on top of the basic broadside approach:
 *
 * - Weather gauge: while still out of effective range and to leeward of the enemy, steer for a
 *   point upwind of him; once to windward, the captain chooses when to bear down.
 * - Raking: in range, if the enemy shows his stern or bow, keep across his line (the basic broadside
 *   course does that); if not, work towards a point off his quarter, where his own broadside cannot
 *   bear and a turn brings ours across his stern.
 *
 * Returns a heading to steer instead of the basic course, or null to keep it.
 */
export const GAUGE_LEAD = 250;

export const tacticalHeading = (me: Entity, t: Entity, d: Doctrine, windDirection: number, range: number, effective: number, loaded: boolean): number | null => {
  const b = me.body!;
  const tb = t.body!;
  // Wind blows towards windDirection: "upwind of the target" lies the other way.
  const wx = Math.sin(windDirection);
  const wz = Math.cos(windDirection);
  if (d.windward && range > effective * 1.15) {
    const leeward = (b.pos.x - tb.pos.x) * wx + (b.pos.z - tb.pos.z) * wz > 0;
    if (leeward) return Math.atan2(tb.pos.x - wx * GAUGE_LEAD - b.pos.x, tb.pos.z - wz * GAUGE_LEAD - b.pos.z);
  }
  if (d.rake && range < effective * 1.1 && !loaded) {
    const th = yawOf(tb.rot);
    const fromTarget = Math.atan2(b.pos.x - tb.pos.x, b.pos.z - tb.pos.z);
    const offAxis = Math.abs(wrapAngle(fromTarget - th));
    // Already off his bow or stern: the broadside course rakes him.
    if (offAxis < 0.5 || offAxis > Math.PI - 0.5) return null;
    // Off his beam (in reach of his broadside): work round to his quarter.
    const qx = tb.pos.x - Math.sin(th) * effective * 0.55;
    const qz = tb.pos.z - Math.cos(th) * effective * 0.55;
    return Math.atan2(qx - b.pos.x, qz - b.pos.z);
  }
  return null;
};

/**
 * Whether to fire at the rigging now: the French school cripples first (masts, sails, rigging) and,
 * once the enemy can no longer manoeuvre, turns its guns on the hull to finish him.
 */
export const firesAtRigging = (d: Doctrine, t: Entity): boolean => {
  if (!d.rigging) return false;
  const s = t.ship!;
  const canvas = s.sailCloth.reduce((a, x) => a + x, 0) / Math.max(1, s.sailCloth.length);
  return s.rigging > 0.5 && canvas > 0.6;
};

/** Height to lay the broadside at: the hull's waterline region, or half up the masts for rigging. */
export const aimHeightFor = (d: Doctrine, t: Entity): number => (firesAtRigging(d, t) ? (t.ship!.model.def.masts[0]?.height ?? 20) * 0.4 : 0.5);
