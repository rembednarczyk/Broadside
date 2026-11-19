import { type Archipelago, SALVAGE, salvageCargo, salvageGold, wreckSites, type WreckSite } from "@broadside/core";
import { type System } from "../systems/context";
import { credit } from "./purse";
export { type Salvage, createSalvage } from "./salvage-state";
import { sortedById } from "../world/world";

/**
 * The salvage system: lying within SALVAGE.radius of an untouched wreck at no more than
 * SALVAGE.maxSpeed for SALVAGE.dwell seconds brings its gold aboard once (core/data/salvage);
 * the state is in salvage-state.ts (kept apart so the system context can name it without a cycle).
 */

/** The wrecks of a world, computed once per archipelago (they are scenery fixed by the seed). */
const sites = new WeakMap<Archipelago, WreckSite[]>();
const wrecksOf = (a: Archipelago): WreckSite[] => {
  let w = sites.get(a);
  if (!w) {
    w = wreckSites(a);
    sites.set(a, w);
  }
  return w;
};

export const salvageSystem: System = (ctx, dt) => {
  const a = ctx.env.archipelago;
  if (!a || !ctx.purse) return;
  const s = ctx.salvage;
  const player = sortedById(ctx.world.with("player", "ship", "body"))[0];
  if (!player || player.ship.sinking) return;
  const p = player.body.pos;
  const v = player.body.vel;
  let near = -1;
  wrecksOf(a).forEach((w, i) => {
    if (near === -1 && !s.salvaged.includes(i) && Math.hypot(w.x - p.x, w.z - p.z) <= SALVAGE.radius) near = i;
  });
  if (near === -1 || Math.hypot(v.x, v.z) > SALVAGE.maxSpeed) {
    s.dwell = 0;
    s.at = -1;
    return;
  }
  if (s.at !== near) {
    s.at = near;
    s.dwell = 0;
  }
  s.dwell += dt;
  if (s.dwell < SALVAGE.dwell) return;
  s.salvaged.push(near);
  s.dwell = 0;
  s.at = -1;
  credit(ctx.purse, ctx.events, salvageGold(ctx.env.seed, near), "wreck");
  // And her cargo, into the hold as plunder to be sold in port.
  ctx.purse.plunder += salvageCargo(ctx.env.seed, near);
};
