import { SURVEY, cellsInSight } from "@broadside/core";
import { type System } from "../systems/context";
import { sortedById } from "../world/world";

/**
 * The lookout's sweep (core/world/survey): every SURVEY.every seconds the cells within
 * SURVEY.sight of the player's ship are marked surveyed, kept in ascending order (a merge, so the
 * same voyage gives the same list). The chart presenter reads it for the fog of war.
 */
export const surveySystem: System = (ctx, dt) => {
  const a = ctx.env.archipelago;
  if (!a) return;
  const s = ctx.survey;
  s.wait -= dt;
  if (s.wait > 0) return;
  s.wait = SURVEY.every;
  const player = sortedById(ctx.world.with("player", "body"))[0];
  if (!player) return;
  const fresh = cellsInSight(a, player.body.pos.x, player.body.pos.z, SURVEY.sight).filter((c) => !s.seen.includes(c));
  if (fresh.length) s.seen = [...s.seen, ...fresh].sort((p, q) => p - q);
};
