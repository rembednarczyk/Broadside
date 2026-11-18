import { type SailLevel, wrapAngle, yawOf } from "@broadside/core";
import { type Entity } from "../world/components";
import { sailableHeading } from "./navigation";
import { clearHeading } from "./captain";
import { type PilotState } from "./pilot-state";

export { type PilotState };

/**
 * Simple steering (the player points, the crew sails): a route of points the ship sails through
 * in turn. The same seamanship as the AI captains' patrols: each leg's bearing made sailable
 * (close-hauled limit; to windward one board to the layline and one tack, the racing sailor's
 * rule for the fewest tacks), then kept clear of shoals (Reynolds' obstacle avoidance), and handed to the helmsman
 * as a course; the helm system tacks or wears and the PID holds it. A route is a Command
 * (`navigate`); the helm or a course from the player takes the wheel back and drops the route.
 */

/** The pilot looks at the route twice a second, as the AI captains do. */
export const PILOT_THINK = 0.5;
/** A point is reached within this distance (or a ship's length and a bit, whichever is larger). */
export const ARRIVE = 25;
/** Sail made when a route is set on a ship with none set: full sail, the AI's cruising plan. */
export const CRUISING: SailLevel = 3;

/** Tack margin of the pilot (navigation.sailableHeading): keep the tack until the point can be laid. */
const LAYLINE = Math.PI;
/** Aim this much above the point besides the leeway (radians): a tack or a wear sets a ship to leeward. */
const OVERSTAND = 0.1;

export const arriveDistance = (length: number): number => Math.max(ARRIVE, length * 1.2);

export const createPilot = (route: readonly { x: number; z: number }[], hold: boolean, heading: number, from: { x: number; z: number }): PilotState => ({ route: route.map((p) => ({ x: p.x, z: p.z })), hold, heading, from: { x: from.x, z: from.z }, think: 0 });

export interface PilotOrder {
  /** Course for the helmsman (null: leave the helm as it is). */
  readonly course: number | null;
  /** Sail to set (null: leave the sails as they are). */
  readonly sails: SailLevel | null;
  /** The route is done: remove the pilot. */
  readonly done: boolean;
}

/** The pilot's order now; `bed` is the seabed height (null: open sea everywhere). */
export const pilotOrder = (me: Entity, p: PilotState, windDirection: number, bed: ((x: number, z: number) => number) | null): PilotOrder => {
  const b = me.body!;
  const s = me.ship!;
  const reach = arriveDistance(s.model.def.hull.length);
  while (p.route.length > 0 && Math.hypot(p.route[0]!.x - b.pos.x, p.route[0]!.z - b.pos.z) < reach) {
    const next = p.route.shift()!;
    // The direction of the leg just finished (as drawn), for holding on after the last point.
    if (Math.hypot(next.x - p.from.x, next.z - p.from.z) > 1) p.heading = Math.atan2(next.x - p.from.x, next.z - p.from.z);
    p.from = next;
  }
  if (p.route.length === 0) {
    if (!p.hold) return { course: wrapAngle(yawOf(b.rot)), sails: 0, done: true };
    const w = { windDirection, bed };
    return { course: clearHeading(me, sailableHeading(p.heading, windDirection, s, yawOf(b.rot)), w), sails: null, done: true };
  }
  const next = p.route[0]!;
  const desired = Math.atan2(next.x - b.pos.x, next.z - b.pos.z);
  // Allowing for leeway (the navigator's correction): the track falls off the heading to leeward,
  // so the pilot aims that much to windward of the point; to windward the same allowance moves
  // the layline out, and he tacks only when the track on the other tack will fetch the point.
  const yaw = yawOf(b.rot);
  const speed = Math.hypot(b.vel.x, b.vel.z);
  if (speed > 1) p.leeway = 0.8 * (p.leeway ?? 0) + 0.2 * Math.min(0.45, Math.abs(wrapAngle(Math.atan2(b.vel.x, b.vel.z) - yaw)));
  // A little more than the leeway: overstanding the layline by what going about costs to leeward.
  const aim = desired - ((p.leeway ?? 0) + OVERSTAND) * Math.sign(Math.sin(windDirection - desired));
  // To windward the pilot holds his tack until the point can be laid on the other (the layline),
  // then goes about once: every tack or wear costs a square rigger a long way to leeward.
  return { course: clearHeading(me, sailableHeading(aim, windDirection, s, yaw, LAYLINE), { windDirection, bed }), sails: null, done: false };
};
