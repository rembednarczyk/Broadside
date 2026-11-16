import { type TrafficKind, TRAFFIC, openWater, pickTraffic, isHostile, standing } from "@broadside/core";
import { type SimContext } from "../systems/context";
import { type Entity } from "./components";
import { sortedById } from "./world";
import { spawnShip } from "./spawn";

/**
 * Population director: keeps a living sea around the player. Modelled on the AI Director of
 * Left 4 Dead (M. Booth, "The AI Systems of Left 4 Dead", AIIDE 2009): spawn out of sight in a
 * ring around the player, remove what drifted far away, and pace the threat (no fresh enemies
 * while a fight is on, only peaceful traffic). We keep only the population budget and the
 * relax phase of Booth's intensity model; the full emotional-intensity curve is left out
 * because a naval fight already paces itself by sailing time.
 */
export const DIRECTOR = {
  /** Seconds between director passes. */
  period: 8,
  /** Ships wanted around the player. */
  budget: 6,
  /** Spawn ring (beyond the lookout's sight in clear weather, 900 m). */
  spawnMin: 1500,
  spawnMax: 2100,
  /** Ships farther than this from the player are taken off the map. */
  keep: 3200,
  /** An enemy this close means the player is fighting (relax: no new enemies). */
  combat: 1200,
} as const;

const dist = (a: Entity, x: number, z: number): number => Math.hypot(a.body!.pos.x - x, a.body!.pos.z - z);

const pick = <T>(items: readonly T[], u: number): T => items[Math.min(items.length - 1, Math.floor(u * items.length))]!;

const spawnTraffic = (ctx: SimContext, kind: TrafficKind, px: number, pz: number): void => {
  const ang = ctx.rng.next() * Math.PI * 2;
  const r = DIRECTOR.spawnMin + ctx.rng.next() * (DIRECTOR.spawnMax - DIRECTOR.spawnMin);
  let x = px + Math.sin(ang) * r;
  let z = pz + Math.cos(ang) * r;
  if (ctx.env.archipelago) ({ x, z } = openWater(ctx.env.archipelago, x, z));
  // A nation at war with the player sends its own hunters after her.
  const nations = (["crown", "republic", "empire"] as const).filter((n) => isHostile(ctx.relations[n]));
  const flags = kind.role === "hunt" ? [...kind.factions, ...nations] : kind.factions;
  const faction = pick(flags, ctx.rng.next());
  const classId = pick(kind.classes, ctx.rng.next());
  // Sail roughly across the player's patch of sea, so traffic passes by instead of away.
  const heading = Math.atan2(px - x, pz - z) + (ctx.rng.next() - 0.5) * 1.6;
  spawnShip(ctx.world, ctx.ids, { classId, faction, x, z, heading, speed: 3, ai: true, role: kind.role, wx: px + (ctx.rng.next() - 0.5) * 1200, wz: pz + (ctx.rng.next() - 0.5) * 1200 });
};

/** One pass of the director: despawn the far, then top the budget up (one ship per pass). */
export const directPopulation = (ctx: SimContext): void => {
  const player = sortedById(ctx.world.with("player", "ship", "body"))[0];
  if (!player || player.ship.sinking) return;
  const px = player.body.pos.x;
  const pz = player.body.pos.z;
  let near = 0;
  let fighting = false;
  for (const e of sortedById(ctx.world.with("captain", "ship", "body"))) {
    const d = dist(e, px, pz);
    if (d > DIRECTOR.keep && !e.ship.sinking && e.id !== ctx.jobs.active?.target) {
      ctx.world.remove(e);
      continue;
    }
    if (e.ship.sinking) continue;
    near++;
    if (d < DIRECTOR.combat && !e.ship.struck && isHostile(standing(e.ship.faction, player.ship.faction, ctx.relations))) fighting = true;
  }
  if (near >= DIRECTOR.budget) return;
  const kinds = fighting ? TRAFFIC.filter((k) => k.peaceful) : TRAFFIC;
  spawnTraffic(ctx, pickTraffic(ctx.rng.next(), kinds), px, pz);
};
