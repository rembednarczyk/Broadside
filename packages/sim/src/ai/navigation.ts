import { DEG, angleOffWind, wrapAngle } from "@broadside/core";
import { type ShipState } from "../ship/ship-state";

/**
 * Sailing judgement shared by AI captains: the no-go zone around the wind and the nearest heading
 * that can actually be sailed. The limits follow the speed polar of the hulls (polar.audit.ts): a
 * square rigger makes good way from about 74 deg off the wind, a fore-and-aft rig from about 50.
 */
export const closeHauled = (s: ShipState): number => {
  const square = s.model.masts.some((m) => m.sails.some((x) => x.rig === "square"));
  return square ? 74 * DEG : 50 * DEG;
};

/**
 * `windDirection` is where the wind blows towards; heading into the wind is PI off it. Beating to
 * windward, the captain keeps his present tack until the other one is clearly better (a margin of
 * about 23 deg), so he sails long boards instead of tacking at every gust of the bearing. A
 * `margin` of PI keeps the tack until the point itself can be laid (tacking on the layline).
 */
const TACK_MARGIN = 0.4;
export const sailableHeading = (desired: number, windDirection: number, s: ShipState, current?: number, margin = TACK_MARGIN): number => {
  if (s.oars && s.model.def.oars > 0) return wrapAngle(desired);
  const limit = Math.PI - closeHauled(s);
  if (angleOffWind(desired, windDirection) <= limit) return wrapAngle(desired);
  const upwind = windDirection + Math.PI;
  const a = wrapAngle(upwind + closeHauled(s));
  const b = wrapAngle(upwind - closeHauled(s));
  const cost = (h: number): number => Math.abs(wrapAngle(h - desired)) - (current !== undefined && Math.abs(wrapAngle(h - current)) < 0.6 ? margin : 0);
  return cost(a) <= cost(b) ? a : b;
};

/** Relative bearing of a point from a heading: 0 dead ahead, +PI/2 to starboard. */
export const relativeBearing = (heading: number, fromX: number, fromZ: number, toX: number, toZ: number): number =>
  wrapAngle(Math.atan2(toX - fromX, toZ - fromZ) - heading);
