import { DEG, angleOffWind, wrapAngle } from "@broadside/core";
import { type ShipState } from "../ship/ship-state";

/**
 * Sailing judgement shared by AI captains: the no-go zone around the wind (square rigs cannot lie
 * closer than about 67 deg off the wind, fore-and-aft rigs about 45 deg) and the nearest heading
 * that can actually be sailed (the captain tacks or wears instead of steering into irons).
 */
export const closeHauled = (s: ShipState): number => {
  const square = s.model.masts.some((m) => m.sails.some((x) => x.rig === "square"));
  return square ? 67 * DEG : 47 * DEG;
};

/** `windDirection` is where the wind blows towards; heading into the wind is PI off it. */
export const sailableHeading = (desired: number, windDirection: number, s: ShipState): number => {
  if (s.oars && s.model.def.oars > 0) return wrapAngle(desired);
  const limit = Math.PI - closeHauled(s);
  if (angleOffWind(desired, windDirection) <= limit) return wrapAngle(desired);
  const upwind = windDirection + Math.PI;
  const a = wrapAngle(upwind + closeHauled(s));
  const b = wrapAngle(upwind - closeHauled(s));
  return Math.abs(wrapAngle(a - desired)) < Math.abs(wrapAngle(b - desired)) ? a : b;
};

/** Relative bearing of a point from a heading: 0 dead ahead, +PI/2 to starboard. */
export const relativeBearing = (heading: number, fromX: number, fromZ: number, toX: number, toZ: number): number =>
  wrapAngle(Math.atan2(toX - fromX, toZ - fromZ) - heading);
