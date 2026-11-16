import { type System } from "./context";

/** Removes entities whose time to live ran out (sunk ships after they went under). */
export const cleanupSystem: System = (ctx, dt) => {
  for (const e of [...ctx.world.with("ttl")]) {
    e.ttl -= dt;
    if (e.ttl <= 0) ctx.world.remove(e);
  }
};
