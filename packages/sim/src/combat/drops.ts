import { type EventQueue, rotate, vec3, add } from "@broadside/core";
import { type Entity } from "../world/components";
import { type SimWorld } from "../world/world";

/** Drops a fire barrel or a mine over the stern; it arms after a few seconds and drifts. */
export const drop = (world: SimWorld, events: EventQueue, e: Entity, ammo: "fireBarrel" | "mine"): boolean => {
  const s = e.ship!;
  if ((s.stores[ammo] ?? 0) <= 0) return false;
  s.stores[ammo] = (s.stores[ammo] ?? 0) - 1;
  const b = e.body!;
  const stern = add(b.pos, rotate(b.rot, vec3(0, 0, -s.model.def.hull.length * 0.6)));
  world.add({ id: 0, floater: { x: stern.x, z: stern.z, ammo, owner: e.id, age: 0 } });
  events.push({ type: "splash", at: stern, size: 1 });
  return true;
};
