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
 * - Line of battle (line ahead, the fighting formation of the Fighting Instructions from 1653 on):
 *   the men-of-war of a squadron follow in the wake of their next ahead at a fixed interval while
 *   their leader fights, so every broadside bears in turn as the line passes the enemy and no ship
 *   masks another's fire. Each follower steers for the station astern of the ship ahead of her
 *   (Reynolds' leader following, chained), not for the enemy; her guns fire as they bear.
 *
 * `tacticalHeading` returns a heading to steer instead of the basic course, or null to keep it.
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

/** Interval between ships in the line (m): close order, about two thirds of a cable. */
export const LINE_INTERVAL = 120;
/** Look-ahead of the line-of-sight guidance (m): how gently a ship off the line converges on it. */
const LINE_LOOKAHEAD = 150;

export interface LineStation {
  /** Course to steer to fall into and keep the wake of the next ahead. */
  readonly course: number;
  /** Distance astern of the next ahead along her heading (m; negative: drawn ahead of her). */
  readonly astern: number;
  /** Canvas to carry: all sail to close up, little to drop back, else that of the next ahead. */
  readonly level: 1 | 2 | 3;
  readonly ahead: Entity;
}

/**
 * Station keeping of a follower in her leader's line of battle. The path is the wake of her next
 * ahead (the leader, or the follower before her by id): a straight line astern along that ship's
 * heading. Steering is line-of-sight guidance (Fossen, "Handbook of Marine Craft Hydrodynamics and
 * Motion Control", 2011, ch. 10): the next ahead's heading, corrected by the angle whose tangent is
 * the cross-track error over a look-ahead distance; the interval is kept with the sails. Chasing
 * the station point itself would turn a ship abeam of her station across the line, often into the
 * wind. Null when she sails alone, is no man-of-war, or her leader is not fighting.
 */
export const lineStation = (me: Entity, ships: readonly Entity[]): LineStation | null => {
  const c = me.captain;
  if (!c || c.leader < 0 || c.role !== "patrol") return null;
  const afloat = (e: Entity): boolean => !e.ship!.sinking && !e.ship!.struck;
  const leader = ships.find((x) => x.id === c.leader && afloat(x));
  if (!leader || leader.captain?.mode !== "engage") return null;
  const line = ships.filter((x) => x.captain?.leader === c.leader && x.captain.role === "patrol" && afloat(x) && x.captain.mode !== "flee").sort((p, q) => p.id - q.id);
  const k = line.findIndex((x) => x.id === me.id);
  const ahead = k <= 0 ? leader : line[k - 1]!;
  const h = yawOf(ahead.body!.rot);
  const dx = me.body!.pos.x - ahead.body!.pos.x;
  const dz = me.body!.pos.z - ahead.body!.pos.z;
  const astern = -(dx * Math.sin(h) + dz * Math.cos(h));
  // Positive to starboard of the wake: steer to port of the line's heading to close it.
  const cross = dx * Math.cos(h) - dz * Math.sin(h);
  const their = Math.max(1, Math.min(3, ahead.ship!.sailTarget[0] ?? 2)) as 1 | 2 | 3;
  const level = astern > LINE_INTERVAL + 50 ? 3 : astern < LINE_INTERVAL - 40 ? 1 : their;
  return { course: wrapAngle(h - Math.atan(cross / LINE_LOOKAHEAD)), astern, level, ahead };
};
