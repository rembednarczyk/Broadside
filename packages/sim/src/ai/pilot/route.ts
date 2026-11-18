import { wrapAngle, yawOf } from "@broadside/core";
import { type Entity } from "../../world/components";
import { type Conn, conn } from "./conn";
import { type Sea, arriveDistance, steerFor, steerHeading } from "./seamanship";
import { type PilotOrder, type PilotState } from "./state";

type Route = Extract<PilotOrder, { kind: "route" }>;

/**
 * A route (a tapped destination or a drawn course): through the points in turn; then a drawn
 * course goes on in the direction of its last leg, a destination takes in sail.
 */
export const sailRoute = (me: Entity, p: PilotState, o: Route, sea: Sea): Conn => {
  const b = me.body!;
  const reach = arriveDistance(me.ship!.model.def.hull.length);
  while (o.route.length > 0 && Math.hypot(o.route[0]!.x - b.pos.x, o.route[0]!.z - b.pos.z) < reach) {
    const next = o.route.shift()!;
    // The direction of the leg just finished (as drawn), for holding on after the last point.
    if (Math.hypot(next.x - o.from.x, next.z - o.from.z) > 1) o.heading = Math.atan2(next.x - o.from.x, next.z - o.from.z);
    o.from = next;
  }
  if (o.route.length === 0) return o.hold ? conn(steerHeading(me, o.heading, sea), null, true) : conn(wrapAngle(yawOf(b.rot)), 0, true);
  return conn(steerFor(me, p, o.route[0]!.x, o.route[0]!.z, sea));
};
