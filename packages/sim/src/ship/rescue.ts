import { isHostile, openWater, quatFromYaw, standing, vec3 } from "@broadside/core";
import { type SimContext } from "../systems/context";
import { type Entity } from "../world/components";
import { createBody } from "../physics/rigid-body";
import { portOwner } from "../economy/trade";
import { shipModel } from "./ship-model";
import { createShipState } from "./ship-state";

/**
 * The captain survives his ship (Overboard!: the crew goes into the water, the game goes on).
 * When the player's ship is about to be taken off the map, the captain turns up at the nearest
 * port that will have him, in command of a sloop with a scratch crew; gold is kept (it was ashore
 * with the agent), plunder in the hold is lost. The entity keeps its id, so commands, camera and
 * saves follow the new hull.
 */
export const RESCUE = { classId: "sloop", crewShare: 0.6 } as const;

export const rescuePlayer = (ctx: SimContext, e: Entity): void => {
  const b = e.body!;
  let best = -1;
  let bestD = Infinity;
  ctx.ports.forEach((p, i) => {
    const owner = portOwner(ctx.world, i, p);
    if (isHostile(standing(owner, "player", ctx.relations))) return;
    const d = Math.hypot(p.x - b.pos.x, p.z - b.pos.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const site = best >= 0 ? ctx.ports[best]! : null;
  let x = site ? site.x : 0;
  let z = site ? site.z : 0;
  if (ctx.env.archipelago) ({ x, z } = openWater(ctx.env.archipelago, x, z, 60));
  const model = shipModel(RESCUE.classId);
  const ship = createShipState(model, "player", 0);
  ship.crew = Math.round(model.def.crew * RESCUE.crewShare);
  e.ship = ship;
  e.body = createBody(model.mass, model.inertia, vec3(x, model.com.y, z), quatFromYaw(0));
  if (e.ttl !== undefined) ctx.world.removeComponent(e, "ttl");
  if (ctx.purse) ctx.purse.plunder = 0;
  ctx.events.push({ type: "playerRescued", port: best });
};
