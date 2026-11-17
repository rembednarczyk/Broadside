import { type EventQueue, type Rng, rotate, vec3, add } from "@broadside/core";
import { type Entity } from "../world/components";
import { type SimWorld } from "../world/world";

/**
 * Men overboard (the heart of Overboard!): a group of sailors in the water beside the ship. They
 * drift, can be picked up by a passing ship (their own rejoin, enemies are taken aboard as
 * pressed hands) and drown if nobody comes.
 */
export const overboard = (world: SimWorld, events: EventQueue, e: Entity, count: number, rng: Rng): void => {
  const s = e.ship!;
  const n = Math.min(count, s.crew);
  if (n <= 0) return;
  s.crew -= n;
  const b = e.body!;
  const side = rng.next() < 0.5 ? -1 : 1;
  const at = add(b.pos, rotate(b.rot, vec3(side * (s.model.def.hull.beam / 2 + 3), 0, (rng.next() - 0.5) * s.model.def.hull.length * 0.6)));
  world.add({ id: 0, castaway: { x: at.x, z: at.z, count: n, from: e.id, age: 0 } });
  events.push({ type: "crewOverboard", ship: e.id, count: n, at: vec3(at.x, 0, at.z) });
};
