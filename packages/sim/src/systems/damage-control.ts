import { rollOf } from "@broadside/core";
import { type System } from "./context";
import { type Entity } from "../world/components";
import { type ShipState, crewShare } from "../ship/ship-state";
import { overboard } from "../combat/crew";
import { sortedById } from "../world/world";

/**
 * Damage control: water comes in through the leaks and is pumped out; carpenters plug holes;
 * fires grow, spread to the neighbouring section and are fought by the crew; a fire in the waist
 * can reach the magazine. A ship that has lost its reserve buoyancy founders (Rules as data and
 * rates; the integration is the fixed step).
 */
const PUMP_PER_MAN = 0.0009;
const PLUG_RATE = 0.035;
const FIRE_GROWTH = 0.045;
const FIRE_FIGHT = 0.11;
const FIRE_HP = 3.5;
const SINK_AFTER = 25;
const REMOVE_AFTER = 45;

const flood = (s: ShipState, dt: number): void => {
  const pumps = s.crew * PUMP_PER_MAN;
  const flooded = s.sections.filter((x) => x.water > 0).length || 1;
  const cap = (s.model.hull.totalVolume / s.sections.length) * 0.9;
  for (const sec of s.sections) {
    sec.water = Math.min(cap, Math.max(0, sec.water + (sec.leak - (sec.water > 0 ? pumps / flooded : 0)) * dt));
    sec.leak = Math.max(0, sec.leak - (sec.leak * PLUG_RATE * crewShare(s) + 0.0002) * dt);
    if (sec.hp === 0) sec.leak = Math.max(sec.leak, 0.06);
  }
};

const burn = (e: Entity, dt: number, raining: boolean, rng: () => number): boolean => {
  const s = e.ship!;
  let magazine = false;
  s.sections.forEach((sec, i) => {
    if (sec.fire <= 0) return;
    sec.fire += (FIRE_GROWTH - FIRE_FIGHT * crewShare(s) * (raining ? 2 : 1) * (sec.fire < 0.5 ? 1.4 : 0.8)) * dt;
    sec.hp = Math.max(0, sec.hp - FIRE_HP * sec.fire * dt);
    const mast = Math.min(s.mastHp.length - 1, Math.floor(i / 2));
    s.sailCloth[mast] = Math.max(0, s.sailCloth[mast]! - 0.01 * sec.fire * dt);
    if (sec.fire > 0.7 && rng() < 0.05 * dt) {
      const next = s.sections[i + (i % 2 === 0 ? 1 : -1)]!;
      next.fire = Math.max(next.fire, 0.2);
    }
    if (i >= 2 && i <= 3 && sec.fire > 0.85 && rng() < 0.02 * dt) magazine = true;
    sec.fire = Math.min(1, Math.max(0, sec.fire));
  });
  return magazine;
};

const waterAboard = (s: ShipState): number => s.sections.reduce((a, x) => a + x.water, 0);

export const damageControlSystem: System = (ctx, dt) => {
  for (const e of sortedById(ctx.world.with("ship", "body"))) {
    const s = e.ship;
    if (s.sinking) {
      s.sunkFor += dt;
      for (const sec of s.sections) sec.leak = Math.max(sec.leak, 0.5);
      flood(s, dt);
      if (s.sunkFor > SINK_AFTER && e.ttl === undefined) {
        ctx.world.addComponent(e, "ttl", REMOVE_AFTER - SINK_AFTER);
        ctx.events.push({ type: "shipSunk", ship: e.id, by: s.lastHitBy });
      }
      continue;
    }
    flood(s, dt);
    const firesBefore = s.sections.map((x) => x.fire > 0);
    if (burn(e, dt, (ctx.env.weather?.rain ?? 0) > 0.4, () => ctx.rng.next())) {
      ctx.events.push({ type: "magazineExploded", ship: e.id, at: e.body.pos });
      for (const sec of s.sections) sec.hp = Math.max(0, sec.hp - s.model.def.sectionHp * 0.8);
      overboard(ctx.world, ctx.events, e, Math.ceil(s.crew * 0.3), ctx.rng);
      s.crew = Math.floor(s.crew * 0.5);
    }
    s.sections.forEach((sec, i) => {
      if (firesBefore[i] && sec.fire === 0) ctx.events.push({ type: "fireOut", ship: e.id, section: i });
    });
    // Crews abandon a burning ship one by one (Overboard!).
    if (s.sections.some((x) => x.fire > 0.6) && ctx.rng.next() < 0.25 * dt) overboard(ctx.world, ctx.events, e, 1 + Math.floor(ctx.rng.next() * 3), ctx.rng);
    const reserve = (s.model.hull.totalVolume - s.model.hull.designVolume) * 0.85;
    const capsized = Math.abs(rollOf(e.body.rot)) > 1.2;
    if (waterAboard(s) > reserve || capsized || s.sections.filter((x) => x.hp === 0).length >= 4) {
      s.sinking = true;
      s.sailTarget = s.sailTarget.map(() => 0);
      ctx.events.push({ type: "shipSinking", ship: e.id });
      overboard(ctx.world, ctx.events, e, Math.ceil(s.crew * 0.6), ctx.rng);
    }
  }
};

