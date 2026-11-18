import { terrainHeight } from "@broadside/core";
import { type System } from "./context";
import { PILOT_THINK, pilotOrder } from "../ai/pilot";
import { sortedById } from "../world/world";

/**
 * Simple steering: ships with a route (the player's taps and drawn courses, `navigate`) are
 * conned along it by their crew (ai/pilot), twice a second, before the helm system steers.
 */
export const pilotSystem: System = (ctx, dt) => {
  const a = ctx.env.archipelago;
  const bed = a ? (x: number, z: number): number => terrainHeight(a, x, z) : null;
  for (const e of sortedById(ctx.world.with("pilot", "ship", "body"))) {
    if (e.ship.sinking || e.ship.struck) {
      ctx.world.removeComponent(e, "pilot");
      continue;
    }
    e.pilot.think -= dt;
    if (e.pilot.think > 0) continue;
    e.pilot.think = PILOT_THINK;
    const order = pilotOrder(e, e.pilot, ctx.env.windDirection, bed);
    if (order.course !== null) e.ship.course = order.course;
    if (order.sails !== null) e.ship.sailTarget = e.ship.sailTarget.map(() => order.sails!);
    if (order.done) ctx.world.removeComponent(e, "pilot");
  }
};
