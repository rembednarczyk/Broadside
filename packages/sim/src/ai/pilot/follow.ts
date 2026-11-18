import { type SailLevel } from "@broadside/core";
import { type Entity } from "../../world/components";
import { keepStation } from "../captain";
import { type Conn, conn } from "./conn";
import { type Sea } from "./seamanship";

/**
 * Keeping station astern of a ship (escorting a merchant, following a consort): the convoy
 * station keeping of the AI captains (captain.keepStation, Reynolds' leader following). Lasts
 * until the ship is gone or the player gives another order.
 */
export const followShip = (me: Entity, leader: Entity | undefined, sea: Sea): Conn => {
  if (!leader?.body || !leader.ship || leader.ship.sinking) return conn(null, null, true);
  let course: number | null = null;
  let sails: SailLevel | null = null;
  for (const c of keepStation(me, leader, sea)) {
    if (c.type === "course") course = c.heading;
    if (c.type === "sails") sails = c.level;
  }
  // Unlike a convoy's station keeping, a ship falling astern of her station crowds on sail until
  // she is back on it (a slower ship would never close the gap under the leader's canvas).
  const d = Math.hypot(leader.body.pos.x - me.body!.pos.x, leader.body.pos.z - me.body!.pos.z);
  if (d > CLOSE_UP) sails = 3;
  return conn(course, sails ?? leader.ship.sailTarget[0] ?? 2);
};

/** Beyond this distance from the leader the follower makes all sail to close up (her station is 140 m astern and 60 abeam). */
const CLOSE_UP = 220;
