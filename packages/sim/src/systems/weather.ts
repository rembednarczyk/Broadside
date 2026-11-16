import { type Rng, type Vec3, rotate, stepWeather, vec3, windNow } from "@broadside/core";
import { type System, type SimContext } from "./context";
import { startRogue } from "../environment/environment";
import { sortedById } from "../world/world";
import { type Entity } from "../world/components";

/**
 * Weather in the world: steps the weather model and turns its ticks into happenings. Lightning
 * seeks the tallest thing nearby (a mast within reach of the strike is hit: damage and fire), a
 * waterspout forms near a ship and wanders down the wind, a rogue wave group raises the swell.
 */
const STRIKE_REACH = 28;

const strike = (ctx: SimContext, ships: Entity[], rng: Rng): void => {
  const near = ships[Math.floor(rng.next() * ships.length)];
  if (!near) return;
  const at: Vec3 = vec3(near.body!.pos.x + (rng.next() - 0.5) * 500, 0, near.body!.pos.z + (rng.next() - 0.5) * 500);
  ctx.events.push({ type: "lightning", at });
  for (const e of ships) {
    const s = e.ship!;
    s.model.def.masts.forEach((m, i) => {
      const p = rotate(e.body!.rot, vec3(0, 0, m.z));
      if (Math.hypot(e.body!.pos.x + p.x - at.x, e.body!.pos.z + p.z - at.z) > STRIKE_REACH || s.mastHp[i]! <= 0) return;
      s.mastHp[i] = Math.max(0, s.mastHp[i]! - s.model.def.mastHp * 0.45);
      if (s.mastHp[i] === 0) ctx.events.push({ type: "mastFell", ship: e.id, mast: i });
      const sec = s.sections[2 + (rng.next() < 0.5 ? 0 : 1)]!;
      if (rng.next() < 0.6) {
        sec.fire = Math.max(sec.fire, 0.3);
        ctx.events.push({ type: "fireStarted", ship: e.id, section: s.sections.indexOf(sec) });
      }
    });
  }
};

const spawnSpout = (ctx: SimContext, ships: Entity[], rng: Rng): void => {
  const near = ships[Math.floor(rng.next() * ships.length)];
  if (!near) return;
  const ang = rng.next() * Math.PI * 2;
  const dist = 350 + rng.next() * 400;
  const speed = 3 + rng.next() * 3;
  ctx.world.add({
    id: 0,
    spout: {
      x: near.body!.pos.x + Math.sin(ang) * dist,
      z: near.body!.pos.z + Math.cos(ang) * dist,
      vx: Math.sin(ctx.env.windDirection) * speed,
      vz: Math.cos(ctx.env.windDirection) * speed,
      radius: 10 + rng.next() * 10,
      age: 0,
      life: 90 + rng.next() * 90,
    },
  });
  ctx.events.push({ type: "weatherChanged", kind: "spout" });
};

export const weatherSystem: System = (ctx, dt) => {
  const w = ctx.env.weather;
  if (!w) return;
  const rng = ctx.env.weatherRng;
  const tick = stepWeather(w, ctx.env.time, dt, rng);
  ctx.env.windSpeed = windNow(w, ctx.env.time);
  ctx.env.windDirection = w.direction;
  if (tick.changed) ctx.events.push({ type: "weatherChanged", kind: tick.changed });
  if (tick.squallStarted) ctx.events.push({ type: "weatherChanged", kind: "squall" });
  const ships = sortedById(ctx.world.with("ship", "body")).filter((e) => !e.ship.sinking);
  if (tick.lightning) strike(ctx, ships, rng);
  if (tick.spout) spawnSpout(ctx, ships, rng);
  if (tick.rogue) {
    startRogue(ctx.env);
    ctx.events.push({ type: "weatherChanged", kind: "rogue" });
  }
};
