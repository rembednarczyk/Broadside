import { type SailLevel } from "@broadside/core";
import { type System } from "./context";
import { sortedById } from "../world/world";

/**
 * A crew with the standing order to reef (the player's choice; on by default in the game) watches
 * the masts as a mate would: when a mast is loaded near breaking (REEF_AT of its strength, the
 * same load the HUD warns of), its canvas comes in a step; once the load has stayed easy for
 * EASY_FOR seconds the sail goes up again a step, never above what the captain set (`wanted`,
 * updated by his own sail orders). Looked at once a second; deterministic.
 */
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
    s.sailTarget.forEach((level, m) => {
      const load = s.mastLoad[m] ?? 0;
      const wanted = r.wanted[m] ?? level;
      if (load > REEF_AT && level > 1) {
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
