import { type Entity } from "../world/components";
import { type CaptainState } from "./captain-state";
import { planRoute } from "./pilot/plan";

/** A turning point of the way is passed within this distance (m): the captain then steers for the next. */
const PASS = 80;

/**
 * The AI captains' way to their waypoint round the islands (the same planner as the player's
 * pilot, ai/pilot/plan: A* over the seabed, then string pulling), planned once when the
 * waypoint changes and kept in the captain's state (saved with the game, deterministic). In clear
 * water the way is the waypoint itself. Returns the point to steer for now.
 */
export const wayPoint = (me: Entity, c: CaptainState, bed: ((x: number, z: number) => number) | null): { x: number; z: number } => {
  const b = me.body!;
  const goal = `${Math.round(c.wx)},${Math.round(c.wz)}`;
  if (c.wayFor !== goal) {
    c.wayFor = goal;
    c.way = planRoute(bed, { x: b.pos.x, z: b.pos.z }, [{ x: c.wx, z: c.wz }], -me.ship!.model.def.hull.draft - 2);
  }
  const way = c.way ?? [];
  while (way.length > 1 && Math.hypot(way[0]!.x - b.pos.x, way[0]!.z - b.pos.z) < PASS) way.shift();
  return way[0] ?? { x: c.wx, z: c.wz };
};
