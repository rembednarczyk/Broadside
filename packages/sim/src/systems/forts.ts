import { type System } from "./context";
import { updateFort } from "../combat/forts";
import { sortedById } from "../world/world";

export const fortSystem: System = (ctx, dt) => {
  const ships = sortedById(ctx.world.with("ship", "body"));
  for (const e of sortedById(ctx.world.with("fort"))) updateFort(ctx.world, ctx.events, e, ships, dt, ctx.rng);
};
