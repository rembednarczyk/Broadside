import { AMMO, vec3, windVector } from "@broadside/core";
import { type System } from "./context";
import { applyBlast } from "../combat/damage";

/** Fire barrels and mines: drift with the wind, arm after a delay, go off when a hull comes close. */
const ARM_TIME = 4;
const OWNER_SAFE = 10;
const LIFETIME = 240;
const TRIGGER = 4;

export const floatersSystem: System = (ctx, dt) => {
  const w = windVector(ctx.env.windDirection, ctx.env.windSpeed);
  for (const e of [...ctx.world.with("floater")]) {
    const f = e.floater;
    f.age += dt;
    f.x += w.x * 0.02 * dt;
    f.z += w.z * 0.02 * dt;
    if (f.age > LIFETIME) {
      ctx.world.remove(e);
      continue;
    }
    if (f.age < ARM_TIME) continue;
    for (const s of ctx.world.with("ship", "body")) {
      if (s.id === f.owner && f.age < OWNER_SAFE) continue;
      const half = s.ship.model.def.hull.length / 2;
      if (Math.hypot(s.body.pos.x - f.x, s.body.pos.z - f.z) < half * 0.7 + TRIGGER) {
        applyBlast(ctx.world, ctx.events, vec3(f.x, 0, f.z), AMMO[f.ammo].blast, f.ammo, f.owner, ctx.rng);
        ctx.world.remove(e);
        break;
      }
    }
  }
};
