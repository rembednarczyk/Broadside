import { windVector } from "@broadside/core";
import { type System } from "./context";
import { sortedById } from "../world/world";

/**
 * Sailors in the water drift with the wind; a ship that passes within reach picks them up (its
 * own men rejoin; others are taken aboard). Unrescued men drown after a while; a few each time.
 */
const REACH = 9;
const DROWN_START = 45;

export const castawaySystem: System = (ctx, dt) => {
  const w = windVector(ctx.env.windDirection, ctx.env.windSpeed);
  const ships = sortedById(ctx.world.with("ship", "body")).filter((e) => !e.ship.sinking);
  for (const e of [...ctx.world.with("castaway")]) {
    const c = e.castaway;
    c.age += dt;
    c.x += w.x * 0.01 * dt;
    c.z += w.z * 0.01 * dt;
    for (const s of ships) {
      const half = s.ship.model.def.hull.length / 2;
      const speed = Math.hypot(s.body.vel.x, s.body.vel.z);
      if (Math.hypot(s.body.pos.x - c.x, s.body.pos.z - c.z) < half + REACH && speed < 5) {
        const room = s.ship.model.def.crew - s.ship.crew;
        const taken = Math.min(room, c.count);
        if (taken > 0) {
          s.ship.crew += taken;
          c.count -= taken;
          ctx.events.push({ type: "crewRescued", ship: s.id, count: taken });
        }
      }
    }
    if (c.age > DROWN_START && ctx.rng.next() < 0.08 * dt * c.count) c.count--;
    if (c.count <= 0) ctx.world.remove(e);
  }
};
