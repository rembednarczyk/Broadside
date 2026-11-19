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
 * a point with water enough under the keel (two metres more than her draught), the outermost
 * from 60% of the boats' reach (core SALVAGE.radius) in to 30 m, so she lies in clear water off
 * the shoal's edge (closer in, the pilot's charted way round the shoal circled), and failing that along lines turned
 * further and further from it round the wreck; sails there under easy canvas and
 * lets go the anchor (systems/anchor) as soon as she is within three quarters of that reach in
 * water deep enough (the spot moves as she closes, so arriving anywhere near will do). With no such
 * point the order is given up.
 */
export const anchorageFor = (me: Entity, at: P, bed: Sea["bed"]): P | null => {
  const b = me.body!;
  const toShip = Math.atan2(b.pos.z - at.z, b.pos.x - at.x);
  const keel = -me.ship!.model.def.hull.draft - 2;
  // The line towards the ship first, then lines turned away from it either side, in 20 degree
  // steps round to the far side (on a ragged coast the straight line may cross a spit of shoal).
  for (let k = 0; k <= 18; k++) {
    const a = toShip + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.349;
    // From the boats' easy reach in towards the wreck: the outermost deep spot keeps clear of the shoal's edge.
    for (let r = SALVAGE.radius * 0.6; r >= 30; r -= 10) {
      const x = at.x + Math.cos(a) * r;
      const z = at.z + Math.sin(a) * r;
      if (!bed || bed(x, z) < keel) return { x, z };
    }
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
