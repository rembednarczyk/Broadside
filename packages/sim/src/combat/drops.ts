import { type EventQueue, rotate, vec3, add } from "@broadside/core";
import { type Entity } from "../world/components";
import { type SimWorld } from "../world/world";

/** Drops a fire barrel or a mine (arms after a few seconds and drifts) or lights a smoke pot over the stern. */
export const drop = (world: SimWorld, events: EventQueue, e: Entity, ammo: "fireBarrel" | "mine" | "smoke"): boolean => {
  const s = e.ship!;
  if ((s.stores[ammo] ?? 0) <= 0) return false;
  s.stores[ammo] = (s.stores[ammo] ?? 0) - 1;
  const b = e.body!;
  const stern = add(b.pos, rotate(b.rot, vec3(0, 0, -s.model.def.hull.length * 0.6)));
  if (ammo === "smoke") world.add({ id: 0, smoke: { x: stern.x, z: stern.z, age: 0 } });
  else world.add({ id: 0, floater: { x: stern.x, z: stern.z, ammo, owner: e.id, age: 0 } });
  events.push({ type: "splash", at: stern, size: 1 });
  return true;
};
