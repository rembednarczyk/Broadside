import { CELLS, type SailLevel, cellInfluence } from "@broadside/core";
import { type System } from "./context";
import { sortedById } from "../world/world";

/**
 * A crew with the standing order to reef (the player's choice; on by default in the game) watches
 * the masts as a mate would: when a mast is loaded near breaking (REEF_AT of its strength, the
 * same load the HUD warns of), its canvas comes in a step; once the load has stayed easy for
 * EASY_FOR seconds the sail goes up again a step, never above what the captain set (`wanted`,
 * updated by his own sail orders). The wind itself sets a ceiling too, as a seaman's rule of thumb
 * does (topgallants in at a strong breeze, close-reefed in a gale): at GALE and above no more than
 * reefed canvas, at STRONG and above no more than battle sails, whatever the masts' load of the
 * moment (by load alone the crew set full sail again in a storm on a broad reach and reefed again
 * seconds later, beta test 19.11). Looked at once a second; deterministic.
 */
/** Wind (m/s, at the ship, with a storm cell's gusts) from which the canvas is held to battle sails, and to reefed. */
const STRONG = 13.9;
const GALE = 17.2;
const REEF_AT = 0.95;
const EASE_BELOW = 0.55;
const EASY_FOR = 8;
const LOOK = 1;

export const reefingSystem: System = (ctx, dt) => {
  for (const e of sortedById(ctx.world.with("reefing", "ship"))) {
    const r = e.reefing;
    const s = e.ship;
    if (s.sinking) continue;
    r.think -= dt;
    if (r.think > 0) continue;
    r.think = LOOK;
    const p = e.body?.pos;
    const wind = ctx.env.windSpeed * (1 + (p ? CELLS.gust * cellInfluence(ctx.env.cells, p.x, p.z) : 0));
    const ceiling = wind >= GALE ? 1 : wind >= STRONG ? 2 : 4;
    s.sailTarget.forEach((level, m) => {
      const load = s.mastLoad[m] ?? 0;
      const wanted = Math.min(r.wanted[m] ?? level, ceiling);
      if ((load > REEF_AT || level > ceiling) && level > 1) {
        s.sailTarget[m] = (level - 1) as SailLevel;
        r.easy[m] = 0;
        ctx.events.push({ type: "reefed", ship: e.id, mast: m, up: false });
      } else if (load < EASE_BELOW && level < wanted) {
        r.easy[m] = (r.easy[m] ?? 0) + LOOK;
        if (r.easy[m]! >= EASY_FOR) {
          s.sailTarget[m] = (level + 1) as SailLevel;
          r.easy[m] = 0;
          ctx.events.push({ type: "reefed", ship: e.id, mast: m, up: true });
        }
      } else r.easy[m] = 0;
    });
  }
};
