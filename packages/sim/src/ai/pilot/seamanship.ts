import { wrapAngle, yawOf } from "@broadside/core";
import { type Entity } from "../../world/components";
import { sailableHeading } from "../navigation";
import { clearHeading } from "../captain";
import { type PilotState } from "./state";

/**
 * The pilot's one skill, shared by every order: a course for the helmsman towards a point. The
 * bearing is made sailable as the AI captains do, but to windward the pilot holds his tack until
 * the point can be laid on the other (tacking on the layline, the racing sailor's rule for the
 * fewest tacks: every tack or wear costs a square rigger a long way to leeward), and he allows
 * for leeway (the navigator's correction: the angle the track falls off the heading, measured and
 * smoothed) plus a little overstand; then the course is kept clear of shoals (Reynolds' obstacle
 * avoidance, captain.clearHeading).
 */
export interface Sea {
  readonly windDirection: number;
  /** Seabed height at a point (null: open sea everywhere). */
  readonly bed: ((x: number, z: number) => number) | null;
}

/** Tack margin (navigation.sailableHeading): keep the tack until the point can be laid. */
const LAYLINE = Math.PI;
/** Aim this much above the point besides the leeway (radians). */
const OVERSTAND = 0.1;
/** A point is reached within this distance (or a ship's length and a bit, whichever is larger). */
export const ARRIVE = 25;

export const arriveDistance = (length: number): number => Math.max(ARRIVE, length * 1.2);

/** Course to steer for (x, z) now; updates the pilot's leeway estimate. */
export const steerFor = (me: Entity, p: PilotState, x: number, z: number, sea: Sea): number => {
  const b = me.body!;
  const yaw = yawOf(b.rot);
  const speed = Math.hypot(b.vel.x, b.vel.z);
  if (speed > 1) p.leeway = 0.8 * (p.leeway ?? 0) + 0.2 * Math.min(0.45, Math.abs(wrapAngle(Math.atan2(b.vel.x, b.vel.z) - yaw)));
  const desired = Math.atan2(x - b.pos.x, z - b.pos.z);
  const aim = desired - ((p.leeway ?? 0) + OVERSTAND) * Math.sign(Math.sin(sea.windDirection - desired));
  return clearHeading(me, sailableHeading(aim, sea.windDirection, me.ship!, yaw, LAYLINE), sea);
};

/** Course to keep a heading (made sailable and clear of shoals). */
export const steerHeading = (me: Entity, heading: number, sea: Sea): number => clearHeading(me, sailableHeading(heading, sea.windDirection, me.ship!, yawOf(me.body!.rot)), sea);
