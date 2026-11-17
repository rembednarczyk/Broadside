import { type System } from "./context";

/**
 * Provisions: the player's crew eats a day's food per game day (an hour of game time passes in
 * four real minutes, so a day is 96 minutes). With the stores empty, hungry men desert.
 */
const DAY = 240 * 24;

export const provisionsSystem: System = (ctx, dt) => {
  const p = ctx.purse;
  if (!p) return;
  for (const e of ctx.world.with("player", "ship")) {
    p.provisions = Math.max(0, p.provisions - dt / DAY);
    if (p.provisions === 0 && ctx.rng.next() < dt / 60) e.ship.crew = Math.max(0, e.ship.crew - 1);
  }
};
