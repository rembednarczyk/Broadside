import { WRECKAGE, rotateInv, vec3 } from "@broadside/core";
import { type System } from "./context";
import { applyForceAt, bodyToWorld, pointVelocity } from "../physics/rigid-body";
import { crewShare } from "../ship/ship-state";
import { windAt } from "../environment/environment";

/**
 * Wreckage alongside (core WRECKAGE): a mast that has just gone by the board falls to leeward and
 * drags there, fast by its rigging, until the crew cut it away. The drag is quadratic in the
 * water's speed past the wreck, applied abeam at the waterline on that side, so it slows the ship
 * and turns her towards the wreck.
 */
export const wreckageSystem: System = (ctx, dt) => {
  for (const e of ctx.world.with("ship", "body")) {
    const s = e.ship;
    const b = e.body;
    if (s.sinking) continue;
    s.mastHp.forEach((hp, mast) => {
      if (hp > 0 || s.wrecks.some((w) => w.mast === mast)) return;
      const wind = windAt(ctx.env, 10, b.pos.x, b.pos.z);
      const side = Math.sign(rotateInv(b.rot, vec3(wind.x, 0, wind.z)).x) || 1;
      s.wrecks.push({ mast, side, left: WRECKAGE.cut / Math.max(0.3, crewShare(s)) });
    });
    for (const w of s.wrecks) {
      if (w.left <= 0) continue;
      w.left = Math.max(0, w.left - dt);
      const def = s.model.def;
      const length = def.masts[w.mast]?.height ?? 20;
      const at = bodyToWorld(b, vec3(w.side * def.hull.beam * 0.6, -s.model.com.y, def.masts[w.mast]?.z ?? 0));
      const v = pointVelocity(b, at);
      const speed = Math.hypot(v.x, v.z);
      if (speed < 1e-3) continue;
      const k = 0.5 * 1025 * WRECKAGE.drag * WRECKAGE.area * length * speed;
      applyForceAt(b, vec3(-v.x * k, 0, -v.z * k), at);
    }
  }
};
