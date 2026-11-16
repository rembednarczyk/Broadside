import { type System } from "./context";
import { decide } from "../ai/captain";
import { applyCommand } from "../commands/apply";
import { sortedById } from "../world/world";

/** AI captains think twice a second and command their ships like a player would. */
const THINK = 0.5;

export const captainSystem: System = (ctx, dt) => {
  const ships = sortedById(ctx.world.with("ship", "body"));
  for (const e of sortedById(ctx.world.with("captain", "ship", "body"))) {
    if (e.ship.sinking) continue;
    e.captain.think -= dt;
    if (e.captain.think > 0) continue;
    e.captain.think = THINK;
    if (e.captain.mode === "struck") continue;
    const wasStruck = e.ship.struck;
    const cmds = decide(e, e.captain, { windDirection: ctx.env.windDirection, fog: ctx.env.weather?.fog ?? 0, ships, rng: () => ctx.rng.next() });
    for (const c of cmds) applyCommand(e, c, ctx);
    if (e.ship.struck && !wasStruck) ctx.events.push({ type: "shipStruck", ship: e.id, side: e.captain.side });
  }
};
