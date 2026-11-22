import { type System } from "./context";
import { decide } from "../ai/captain";
import { screens } from "../combat/smoke";
import { applyCommand } from "../commands/apply";
import { sortedById } from "../world/world";
import { terrainHeight } from "@broadside/core";
import { chartedBed, gridBed } from "../ai/pilot/plan";
import { type SimContext } from "./context";

const bedOf = (ctx: SimContext): ((x: number, z: number) => number) | null => {
  const a = ctx.env.archipelago;
  return a ? gridBed(a, chartedBed(a.half, (x, z) => terrainHeight(a, x, z))) : null;
};

/** AI captains think twice a second and command their ships like a player would. */
const THINK = 0.5;

/**
 * The quarry of the player's contract (a bounty or a raid; not a merchantman under escort, whom
 * others may well attack): the other captains and the forts leave her to the player, who has the
 * contract on her. She was sunk or taken by others before the player came up in most of the
 * playtest audit's contracts (20.11). She still sees and fights whom she will.
 */
export const spared = (ctx: SimContext): number => {
  const j = ctx.jobs.active;
  return j && j.offer.kind !== "escort" ? j.target : -1;
};

export const captainSystem: System = (ctx, dt) => {
  const all = sortedById(ctx.world.with("ship", "body"));
  const spare = spared(ctx);
  const others = spare < 0 ? all : all.filter((s) => s.id !== spare);
  const smoke = screens(ctx.world);
  for (const e of sortedById(ctx.world.with("captain", "ship", "body"))) {
    if (e.ship.sinking) continue;
    e.captain.think -= dt;
    if (e.captain.think > 0) continue;
    e.captain.think = THINK;
    if (e.captain.mode === "struck") continue;
    const wasStruck = e.ship.struck;
    const ships = e.id === spare ? all : others;
    const cmds = decide(e, e.captain, { windDirection: ctx.env.windDirection, fog: ctx.env.weather?.fog ?? 0, bed: bedOf(ctx), ships, rng: () => ctx.rng.next(), ports: ctx.ports, relations: ctx.relations, screens: smoke, forts: sortedById(ctx.world.with("fort")) });
    for (const c of cmds) applyCommand(e, c, ctx);
    if (e.ship.struck && !wasStruck) ctx.events.push({ type: "shipStruck", ship: e.id, side: e.captain.side });
  }
};
