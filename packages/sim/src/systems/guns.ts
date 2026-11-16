import { type System } from "./context";
import { updateGuns } from "../combat/gunnery";
import { sortedById } from "../world/world";

export const gunsSystem: System = (ctx, dt) => {
  for (const e of sortedById(ctx.world.with("ship", "body"))) {
    if (e.ship.braced > 0) e.ship.braced = Math.max(0, e.ship.braced - dt);
    updateGuns(ctx.world, ctx.events, e, dt, ctx.rng);
  }
};
