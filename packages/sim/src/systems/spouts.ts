import { vec3 } from "@broadside/core";
import { type System } from "./context";
import { applyForce, applyTorque } from "../physics/rigid-body";
import { overboard } from "../combat/crew";
import { sortedById } from "../world/world";

/**
 * Waterspouts: a rotating column that lifts and spins whatever it touches. Inside its radius a
 * ship is twisted, lifted and battered (sails, rigging, masts, crew swept overboard); within three
 * radii the gusts tear canvas. Lifetime-limited, then it collapses.
 */
export const spoutSystem: System = (ctx, dt) => {
  const ships = sortedById(ctx.world.with("ship", "body")).filter((e) => !e.ship.sinking);
  for (const e of [...ctx.world.with("spout")]) {
    const sp = e.spout;
    sp.age += dt;
    sp.x += sp.vx * dt;
    sp.z += sp.vz * dt;
    if (sp.age > sp.life) {
      ctx.world.remove(e);
      continue;
    }
    for (const sh of ships) {
      const s = sh.ship;
      const b = sh.body;
      const d = Math.hypot(b.pos.x - sp.x, b.pos.z - sp.z) - s.model.def.hull.beam / 2;
      if (d > sp.radius * 3) continue;
      const near = Math.max(0, 1 - d / (sp.radius * 3));
      s.sailCloth = s.sailCloth.map((c) => Math.max(0, c - 0.04 * near * dt));
      s.rigging = Math.max(0, s.rigging - 0.02 * near * dt);
      if (d < sp.radius) {
        const core = 1 - Math.max(0, d) / sp.radius;
        applyTorque(b, vec3(0, b.inertia.y * 0.25 * core, 0));
        applyForce(b, vec3(0, b.mass * 9.81 * 0.18 * core, 0));
        s.mastHp = s.mastHp.map((hp, i) => {
          const next = Math.max(0, hp - s.model.def.mastHp * 0.06 * core * dt);
          if (hp > 0 && next === 0) ctx.events.push({ type: "mastFell", ship: sh.id, mast: i });
          return next;
        });
        if (ctx.rng.next() < 0.6 * core * dt) overboard(ctx.world, ctx.events, sh, 1 + Math.floor(ctx.rng.next() * 3), ctx.rng);
      }
    }
  }
};
