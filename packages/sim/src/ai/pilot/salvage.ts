import { SALVAGE } from "@broadside/core";
import { type Entity } from "../../world/components";
import { type Conn, conn } from "./conn";
import { type Sea, steerFor } from "./seamanship";
import { type P, type PilotState } from "./state";

/** Reached the anchorage within this distance (m). */
const ARRIVED = 25;

/**
 * Salvaging a wreck (the period's way: the ship anchors off the shoal the wreck lies on and the
 * boats and divers work her): the pilot looks along the line from the wreck towards the ship for
 * the first point with water enough under the keel (two metres more than her draught), no nearer
 * than 30 m and within the boats' reach (core SALVAGE.radius); sails there under easy canvas and
 * lets go the anchor (systems/anchor) as soon as she is within three quarters of that reach in
 * water deep enough (the spot moves as she closes, so arriving anywhere near will do). With no such
 * point the order is given up.
 */
export const anchorageFor = (me: Entity, at: P, bed: Sea["bed"]): P | null => {
  const b = me.body!;
  const dx = b.pos.x - at.x;
  const dz = b.pos.z - at.z;
  const d = Math.hypot(dx, dz) || 1;
  const keel = -me.ship!.model.def.hull.draft - 2;
  for (let r = 30; r <= SALVAGE.radius * 0.85; r += 10) {
    const x = at.x + (dx / d) * r;
    const z = at.z + (dz / d) * r;
    if (!bed || bed(x, z) < keel) return { x, z };
  }
  return null;
};

export const lieOverWreck = (me: Entity, p: PilotState, at: P, sea: Sea): Conn => {
  const b = me.body!;
  // Within the boats' reach (with a margin for her swinging to the anchor) in water deep enough: anchor here.
  const keel = -me.ship!.model.def.hull.draft - 2;
  const near = Math.hypot(at.x - b.pos.x, at.z - b.pos.z) <= SALVAGE.radius * 0.75;
  if (near && (!sea.bed || sea.bed(b.pos.x, b.pos.z) < keel)) return conn(null, 0, true, [{ type: "anchor", ship: me.id, down: true }]);
  const spot = anchorageFor(me, at, sea.bed);
  if (!spot) return conn(null, 0, true);
  const d = Math.hypot(spot.x - b.pos.x, spot.z - b.pos.z);
  if (d <= ARRIVED) return conn(null, 0, true, [{ type: "anchor", ship: me.id, down: true }]);
  // Easy canvas on the way in (the shoal is close): battle sails, furled for the last 60 m.
  return conn(steerFor(me, p, spot.x, spot.z, sea), d < 60 ? 0 : 2);
};
