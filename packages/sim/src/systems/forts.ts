import { type System } from "./context";
import { updateFort } from "../combat/forts";
import { sortedById } from "../world/world";
import { spared } from "./captain";

export const fortSystem: System = (ctx, dt) => {
  const all = sortedById(ctx.world.with("ship", "body"));
  // The contract's quarry is the player's (systems/captain spared), unless she fired on the fort.
  const spare = spared(ctx);
  for (const e of sortedById(ctx.world.with("fort"))) {
    const ships = spare < 0 || e.fort!.provokedBy === spare ? all : all.filter((s) => s.id !== spare);
    updateFort(ctx.world, ctx.events, e, ships, dt, ctx.rng, ctx.relations);
  }
};
