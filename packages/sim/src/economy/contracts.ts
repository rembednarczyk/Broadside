import { type ContractOffer, type Faction, CONTRACT_EPOCH, applyDeed, contractOffer, openWater } from "@broadside/core";
import { type ShipEntity } from "../commands/handler";
import { type SimContext } from "../systems/context";
import { spawnShip } from "../world/spawn";
import { credit } from "./purse";
import { type Contract } from "./jobs";

export type { Contract, Jobs } from "./jobs";

/**
 * The contract the player has taken (one at a time). Offers come from `core/data/contracts`; this
 * module spawns the ship a contract is about and judges it each step: a bounty or raid succeeds
 * when the target strikes or sinks, an escort when the merchantman reaches its port.
 */
/** Standing gained with the giver for a job well done. */
const GOODWILL = 0.1;
/** An escort is home when this close to its port (m). */
const ARRIVED = 300;

export const offerAt = (ctx: SimContext, port: number, owner: Faction): ContractOffer =>
  contractOffer(ctx.env.seed, port, Math.floor(ctx.env.time / CONTRACT_EPOCH), owner, ctx.ports.length);

export const acceptContract = (e: ShipEntity, port: number, owner: Faction, ctx: SimContext): void => {
  if (ctx.jobs.active) return;
  const offer = offerAt(ctx, port, owner);
  const site = ctx.ports[port]!;
  let x: number;
  let z: number;
  if (offer.kind === "escort") {
    x = e.body.pos.x + 90;
    z = e.body.pos.z + 40;
  } else {
    const ang = ctx.rng.next() * Math.PI * 2;
    const r = 1300 + ctx.rng.next() * 600;
    x = site.x + Math.sin(ang) * r;
    z = site.z + Math.cos(ang) * r;
  }
  if (ctx.env.archipelago) ({ x, z } = openWater(ctx.env.archipelago, x, z));
  const dest = offer.dest >= 0 ? ctx.ports[offer.dest]! : null;
  const t = spawnShip(ctx.world, ctx.ids, {
    classId: offer.classId,
    faction: offer.faction,
    x,
    z,
    heading: dest ? Math.atan2(dest.x - x, dest.z - z) : ctx.rng.next() * Math.PI * 2,
    speed: 2,
    ai: true,
    role: offer.kind === "bounty" ? "patrol" : "trade",
    ...(dest ? { wx: dest.x, wz: dest.z } : {}),
  });
  if (dest && t.captain) t.captain.dest = offer.dest;
  ctx.jobs.active = { offer, port, giver: owner, target: t.id, deadline: ctx.env.time + offer.time };
  ctx.events.push({ type: "contractAccepted", kind: offer.kind, target: t.id });
};

const settle = (ctx: SimContext, c: Contract, done: boolean): void => {
  ctx.jobs.active = null;
  if (!done) {
    ctx.events.push({ type: "contractFailed", kind: c.offer.kind });
    return;
  }
  if (ctx.purse) credit(ctx.purse, ctx.events, c.offer.reward, "contract");
  if (c.giver !== "pirates" && c.giver !== "player") applyDeed(ctx.relations, c.giver, GOODWILL);
  ctx.events.push({ type: "contractDone", kind: c.offer.kind, reward: c.offer.reward });
};

/** Judges the active contract (called by the contracts system each step). */
export const judgeContract = (ctx: SimContext): void => {
  const c = ctx.jobs.active;
  if (!c) return;
  let t: ShipEntity | null = null;
  for (const e of ctx.world.with("ship", "body")) if (e.id === c.target) t = e;
  if (!t) return settle(ctx, c, false);
  if (c.offer.kind === "escort") {
    if (t.ship.sinking || t.ship.struck) return settle(ctx, c, false);
    const d = ctx.ports[c.offer.dest]!;
    if (Math.hypot(t.body.pos.x - d.x, t.body.pos.z - d.z) < ARRIVED) return settle(ctx, c, true);
  } else if (t.ship.sinking || t.ship.struck) return settle(ctx, c, true);
  if (ctx.env.time > c.deadline) settle(ctx, c, false);
};
