import { terrainHeight } from "@broadside/core";
import { type System } from "./context";
import { PILOT_THINK, conning } from "../ai/pilot/pilot";
import { applyCommand } from "../commands/apply";
import { sortedById } from "../world/world";
import { screens } from "../combat/smoke";

/**
 * Simple steering: ships with an order from the player (a route, a ship to board or follow, a
 * fort to storm; ai/pilot) are conned by their crew twice a second, before the helm system
 * steers: the course goes to the helmsman, the sail plan to the topmen, and boarding or storming
 * as commands, the same ones the player's buttons send.
 */
export const pilotSystem: System = (ctx, dt) => {
  const a = ctx.env.archipelago;
  const bed = a ? (x: number, z: number): number => terrainHeight(a, x, z) : null;
  const ships = sortedById(ctx.world.with("ship", "body"));
  const forts = sortedById(ctx.world.with("fort"));
  const smoke = screens(ctx.world);
  for (const e of sortedById(ctx.world.with("pilot", "ship", "body"))) {
    if (e.ship.sinking || e.ship.struck) {
      ctx.world.removeComponent(e, "pilot");
      continue;
    }
    e.pilot.think -= dt;
    if (e.pilot.think > 0) continue;
    e.pilot.think = PILOT_THINK;
    const c = conning(e, e.pilot, { windDirection: ctx.env.windDirection, fog: ctx.env.weather?.fog ?? 0, bed, ships, rng: () => ctx.rng.next(), ports: ctx.ports, relations: ctx.relations, screens: smoke, forts });
    if (c.course !== null) e.ship.course = c.course;
    if (c.sails !== null) e.ship.sailTarget = e.ship.sailTarget.map(() => c.sails!);
    if (c.done) ctx.world.removeComponent(e, "pilot");
    for (const cmd of c.commands) applyCommand(e, cmd, ctx);
  }
};
