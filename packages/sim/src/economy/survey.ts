import { type Archipelago, SURVEY, type WreckSite, cellsInSight, lookoutRange, wreckSites } from "@broadside/core";
import { type System } from "../systems/context";
import { sortedById } from "../world/world";

/**
 * The lookout's sweep (core/world/survey): every SURVEY.every seconds the cells within
 * the lookout's range of the player's ship (shorter in fog, lookoutRange) are marked surveyed, kept in ascending order (a merge, so the
 * same voyage gives the same list). The chart presenter reads it for the fog of war.
 *
 * Harbour talk: lying alongside a port (within RUMOUR_AT of its anchorage, nearly stopped) the
 * player hears of the nearest wreck still unsalvaged within RUMOUR_REACH, and her water goes on
 * the chart (the cells within RUMOUR_RADIUS of her). Wrecks lay hidden in the fog until a ship
 * happened within 900 m of one (beta test 19.11).
 */
const RUMOUR_AT = 200;
const RUMOUR_REACH = 4000;
const RUMOUR_RADIUS = 400;
const wrecks = new WeakMap<Archipelago, WreckSite[]>();
const wrecksOf = (a: Archipelago): WreckSite[] => {
  let w = wrecks.get(a);
  if (!w) {
    w = wreckSites(a);
    wrecks.set(a, w);
  }
  return w;
};
export const surveySystem: System = (ctx, dt) => {
  const a = ctx.env.archipelago;
  if (!a) return;
  const s = ctx.survey;
  s.wait -= dt;
  if (s.wait > 0) return;
  s.wait = SURVEY.every;
  const player = sortedById(ctx.world.with("player", "body"))[0];
  if (!player) return;
  const p = player.body.pos;
  const cells = cellsInSight(a, p.x, p.z, lookoutRange(ctx.env.weather?.fog ?? 0));
  const alongside = Math.hypot(player.body.vel.x, player.body.vel.z) < 1 && ctx.ports.some((port) => Math.hypot(port.ax - p.x, port.az - p.z) < RUMOUR_AT);
  if (alongside) {
    let best: WreckSite | null = null;
    let bestD = RUMOUR_REACH;
    wrecksOf(a).forEach((w, i) => {
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      if (!ctx.salvage.salvaged.includes(i) && d < bestD) {
        best = w;
        bestD = d;
      }
    });
    const w = best as WreckSite | null;
    if (w) cells.push(...cellsInSight(a, w.x, w.z, RUMOUR_RADIUS));
  }
  const fresh = [...new Set(cells)].filter((c) => !s.seen.includes(c));
  if (fresh.length) s.seen = [...s.seen, ...fresh].sort((p, q) => p - q);
};
