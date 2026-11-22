import { AMMO, rotate, stepShot, terrainHeight, vec3, waterHeight } from "@broadside/core";
import { type System } from "./context";
import { type Entity } from "../world/components";
import { segmentHit, rigBox, type RigBox } from "../combat/hit-test";
import { applyBlast, applyImpact } from "../combat/damage";
import { damageFort, hitsFort } from "../combat/forts";
import { type ShipModel } from "../ship/ship-model";
import { sortedById } from "../world/world";

/**
 * Projectiles in flight: ballistics, then the swept segment of the step against every ship, then
 * the water. Round shot striking the sea at a shallow angle skips (ricochet fire, a deliberate
 * period technique), anything else splashes; shells burst.
 */
const MAX_AGE = 14;
const OWNER_GRACE = 0.25;
const rigs = new Map<ShipModel, RigBox>();
const rigOf = (m: ShipModel): RigBox => {
  let r = rigs.get(m);
  if (!r) {
    r = rigBox(m);
    rigs.set(m, r);
  }
  return r;
};

const tryShips = (ctx: Parameters<System>[0], shot: Entity, ships: Entity[]): boolean => {
  const sh = shot.shot!;
  const from = vec3(sh.s.x - sh.s.vx * (1 / 60), sh.s.y - sh.s.vy * (1 / 60), sh.s.z - sh.s.vz * (1 / 60));
  const to = vec3(sh.s.x, sh.s.y, sh.s.z);
  let best: { e: Entity; t: number; local: ReturnType<typeof vec3>; where: "hull" | "rig" } | null = null;
  for (const e of ships) {
    if (e.id === sh.owner && sh.age < OWNER_GRACE) continue;
    const b = e.body!;
    const reach = e.ship!.model.def.hull.length;
    if (Math.abs(b.pos.x - to.x) > reach + 10 || Math.abs(b.pos.z - to.z) > reach + 10) continue;
    const hit = segmentHit(b, e.ship!.model, rigOf(e.ship!.model), from, to);
    if (hit && (!best || hit.t < best.t)) best = { e, t: hit.t, local: hit.local, where: hit.where };
  }
  if (!best) return false;
  const at = vec3(from.x + (to.x - from.x) * best.t, from.y + (to.y - from.y) * best.t, from.z + (to.z - from.z) * best.t);
  const speed = Math.hypot(sh.s.vx, sh.s.vy, sh.s.vz);
  const blast = AMMO[sh.ammo].blast;
  if (blast > 0) applyBlast(ctx.world, ctx.events, at, blast, sh.ammo, sh.owner, ctx.rng);
  else {
    // How nearly the ball ran along the target's keel line (1: straight through stern or bow).
    const fwd = rotate(best.e.body!.rot, vec3(0, 0, 1));
    const horiz = Math.hypot(sh.s.vx, sh.s.vz) || 1;
    const along = Math.abs((sh.s.vx * fwd.x + sh.s.vz * fwd.z) / horiz);
    const raking = Math.max(0, Math.min(1, (along - 0.75) / 0.25));
    applyImpact(ctx.world, ctx.events, best.e, { ammo: sh.ammo, mass: sh.mass, speed, by: sh.owner, local: best.local, world: at, where: best.where, raking }, ctx.rng);
  }
  return true;
};

const tryForts = (ctx: Parameters<System>[0], shot: Entity): boolean => {
  const sh = shot.shot!;
  const from = vec3(sh.s.x - sh.s.vx / 60, sh.s.y - sh.s.vy / 60, sh.s.z - sh.s.vz / 60);
  const to = vec3(sh.s.x, sh.s.y, sh.s.z);
  for (const f of ctx.world.with("fort")) {
    if (f.id === sh.owner) continue;
    const strike = hitsFort(f.fort, from, to);
    if (strike === null) continue;
    const t = strike.t;
    const at = vec3(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.z + (to.z - from.z) * t);
    damageFort(ctx.events, f, sh.owner, sh.mass, Math.hypot(sh.s.vx, sh.s.vy, sh.s.vz), sh.ammo, at, ctx.rng, strike);
    if (AMMO[sh.ammo].blast > 0) ctx.events.push({ type: "explosion", at, radius: AMMO[sh.ammo].blast });
    return true;
  }
  return false;
};

/** Shot striking land: it buries itself in the hillside with a puff of earth. */
const tryLand = (ctx: Parameters<System>[0], shot: Entity): boolean => {
  const a = ctx.env.archipelago;
  if (!a) return false;
  const sh = shot.shot!;
  if (sh.s.y > 150) return false;
  const ground = terrainHeight(a, sh.s.x, sh.s.z);
  if (ground < 0 || sh.s.y > ground) return false;
  ctx.events.push({ type: "explosion", at: vec3(sh.s.x, ground, sh.s.z), radius: AMMO[sh.ammo].blast > 0 ? AMMO[sh.ammo].blast : 1 });
  return true;
};

const tryWater = (ctx: Parameters<System>[0], shot: Entity): boolean => {
  const sh = shot.shot!;
  const wy = waterHeight(ctx.env.waves, sh.s.x, sh.s.z, ctx.env.time);
  if (sh.s.y > wy) return false;
  const speed = Math.hypot(sh.s.vx, sh.s.vy, sh.s.vz);
  const at = vec3(sh.s.x, wy, sh.s.z);
  const blast = AMMO[sh.ammo].blast;
  if (blast > 0) {
    applyBlast(ctx.world, ctx.events, at, blast * 0.8, sh.ammo, sh.owner, ctx.rng);
    return true;
  }
  const grazing = -sh.s.vy / speed < 0.2;
  if (grazing && speed > 35 && sh.bounces < 2 && AMMO[sh.ammo].pellets === 1) {
    sh.bounces++;
    sh.s.y = wy + 0.05;
    sh.s.vy = Math.abs(sh.s.vy) * 0.45;
    sh.s.vx *= 0.62;
    sh.s.vz *= 0.62;
    ctx.events.push({ type: "ricochet", at });
    return false;
  }
  ctx.events.push({ type: "splash", at, size: Math.cbrt(sh.mass) });
  return true;
};

export const shotsSystem: System = (ctx, dt) => {
  const ships = sortedById(ctx.world.with("ship", "body")).filter((e) => !e.ship.sinking || e.ship.sunkFor < 5);
  for (const e of [...ctx.world.with("shot")]) {
    const sh = e.shot;
    stepShot(sh.s, sh.k, dt);
    sh.age += dt;
    if (tryShips(ctx, e, ships) || tryForts(ctx, e) || tryLand(ctx, e) || tryWater(ctx, e) || sh.age > MAX_AGE) ctx.world.remove(e);
  }
};
