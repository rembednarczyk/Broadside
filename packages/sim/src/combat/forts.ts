import { type EventQueue, type FortSite, type Rng, type Vec3, FORT_CLASSES, FORT_RANGE, MORTAR_RANGE, MORTAR_SPEED, type Relations, isHostile, standing, vec3, impactEnergy, DAMAGE_PER_JOULE, AMMO } from "@broadside/core";
import { type Entity, type FortState } from "../world/components";
import { type SimWorld } from "../world/world";
import { elevationForRange, MORTAR_ELEVATION, mortarSpeed, muzzleSpeed } from "./aim";
import { launchShot } from "./gunnery";

/**
 * Shore forts: batteries that fire salvos at hostile (or provoking) ships in range, take damage
 * through their stone (armour), lose guns to hits, fall silent when the last gun is down and can
 * then be stormed by a landing party.
 */
export const createFort = (site: FortSite): FortState => {
  const def = FORT_CLASSES[site.classId];
  return { def, site, faction: site.faction, hp: def.hp, guns: Array.from({ length: def.guns }, () => 0), mortars: Array.from({ length: def.mortars }, () => 0), garrison: def.garrison, provokedBy: null, silenced: false };
};

const RELOAD = 14;
const MORTAR_RELOAD = 22;

export const fortCentre = (f: FortState): Vec3 => vec3(f.site.x, f.site.y + f.def.height * 0.5, f.site.z);

const targetOf = (f: FortState, ships: readonly Entity[], rel: Relations | null): { e: Entity; range: number } | null => {
  let best: { e: Entity; range: number } | null = null;
  for (const e of ships) {
    const s = e.ship!;
    if (s.sinking || s.struck) continue;
    if (e.id !== f.provokedBy && !isHostile(standing(f.faction, s.faction, rel))) continue;
    const r = Math.hypot(e.body!.pos.x - f.site.x, e.body!.pos.z - f.site.z);
    if (r < MORTAR_RANGE && (!best || r < best.range)) best = { e, range: r };
  }
  return best;
};

export const updateFort = (world: SimWorld, events: EventQueue, fe: Entity, ships: readonly Entity[], dt: number, rng: Rng, rel: Relations | null = null): void => {
  const f = fe.fort!;
  f.guns = f.guns.map((g) => (g > 0 ? Math.max(0, g - dt) : g));
  f.mortars = f.mortars.map((g) => (g > 0 ? Math.max(0, g - dt) : g));
  if (f.silenced) return;
  const t = targetOf(f, ships, rel);
  if (!t) return;
  const tb = t.e.body!;
  const tof = t.range / 95;
  const px = tb.pos.x + tb.vel.x * tof;
  const pz = tb.pos.z + tb.vel.z * tof;
  const range = Math.hypot(px - f.site.x, pz - f.site.z);
  const bearing = Math.atan2(px - f.site.x, pz - f.site.z);
  const muzzleY = f.site.y + f.def.height * 0.8;
  const muzzle = vec3(f.site.x + Math.sin(bearing) * f.def.radius, muzzleY, f.site.z + Math.cos(bearing) * f.def.radius);
  if (range < FORT_RANGE) {
    let fired = 0;
    f.guns.forEach((g, i) => {
      if (g !== 0 || fired >= f.def.salvo) return;
      const elev = elevationForRange(range, f.def.pounder, f.def.ammo, muzzleY);
      const dir = vec3(Math.sin(bearing) * Math.cos(elev), Math.sin(elev), Math.cos(bearing) * Math.cos(elev));
      launchShot(world, fe.id, muzzle, dir, muzzleSpeed(f.def.ammo, false), f.def.pounder, f.def.ammo, rng);
      events.push({ type: "gunFired", ship: fe.id, at: muzzle, dir, pounder: f.def.pounder, ammo: f.def.ammo });
      f.guns[i] = RELOAD * (0.8 + rng.next() * 0.4);
      fired++;
    });
  }
  if (range > 150) {
    f.mortars.forEach((m, i) => {
      if (m !== 0) return;
      const speed = Math.min(MORTAR_SPEED, mortarSpeed(range));
      const dir = vec3(Math.sin(bearing) * Math.cos(MORTAR_ELEVATION), Math.sin(MORTAR_ELEVATION), Math.cos(bearing) * Math.cos(MORTAR_ELEVATION));
      launchShot(world, fe.id, muzzle, dir, speed, 130, "shell", rng);
      events.push({ type: "gunFired", ship: fe.id, at: muzzle, dir, pounder: 130, ammo: "shell" });
      f.mortars[i] = MORTAR_RELOAD;
    });
  }
};

/** Segment against the fort's works (a vertical cylinder). */
export const hitsFort = (f: FortState, from: Vec3, to: Vec3): number | null => {
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (Math.hypot(x - f.site.x, z - f.site.z) <= f.def.radius && y >= f.site.y - 2 && y <= f.site.y + f.def.height) return t;
  }
  return null;
};

/** A hit on the walls: stone takes part of the blow; enough damage dismounts a gun. */
export const damageFort = (events: EventQueue, fe: Entity, by: number, mass: number, speed: number, ammoId: keyof typeof AMMO, at: Vec3, rng: Rng): void => {
  const f = fe.fort!;
  const dmg = impactEnergy(mass, speed) * DAMAGE_PER_JOULE * f.def.armour * (AMMO[ammoId].hull + AMMO[ammoId].blast * 0.15);
  f.hp = Math.max(0, f.hp - dmg);
  f.provokedBy = by;
  events.push({ type: "hit", ship: fe.id, by, at, part: "gun", damage: dmg });
  const perGun = f.def.hp / Math.max(1, f.def.guns);
  if (rng.next() < Math.min(0.9, dmg / perGun * 1.5)) {
    const alive = f.guns.map((g, i) => ({ g, i })).filter((x) => x.g >= 0);
    const pickIt = alive[Math.floor(rng.next() * alive.length)];
    if (pickIt) f.guns[pickIt.i] = -1;
  }
  if (f.hp <= 0) {
    f.guns = f.guns.map(() => -1);
    f.mortars = f.mortars.map(() => -1);
  }
  f.garrison = Math.max(0, f.garrison - Math.floor(dmg * 0.05 + rng.next()));
  if (!f.silenced && f.guns.every((g) => g < 0) && f.mortars.every((g) => g < 0)) {
    f.silenced = true;
    events.push({ type: "fortSilenced", fort: fe.id, by });
  }
};

/** Storming party: up to two thirds of the crew against the garrison (Lanchester-style ratio). */
export const assault = (events: EventQueue, ship: Entity, fe: Entity, rng: Rng, onCapture: (gold: number) => void = () => {}): void => {
  const f = fe.fort!;
  const s = ship.ship!;
  if (!f.silenced) return;
  const d = Math.hypot(ship.body!.pos.x - f.site.x, ship.body!.pos.z - f.site.z);
  if (d > f.def.radius + 200) return;
  const party = Math.floor(s.crew * 0.66);
  const strength = party * (0.8 + rng.next() * 0.4);
  const defence = f.garrison * 1.4;
  if (strength > defence) {
    const lost = Math.min(party, Math.ceil((defence / strength) * party * 0.5));
    s.crew -= lost;
    const from = f.faction;
    f.faction = s.faction;
    f.garrison = Math.max(10, Math.floor((party - lost) * 0.3));
    s.crew -= Math.min(s.crew, f.garrison);
    f.guns = f.guns.map(() => 0);
    f.silenced = false;
    f.hp = f.def.hp * 0.5;
    f.provokedBy = null;
    events.push({ type: "fortCaptured", fort: fe.id, by: ship.id, gold: f.def.treasury, from });
    onCapture(f.def.treasury);
  } else {
    const lost = Math.ceil(party * 0.6);
    s.crew -= lost;
    f.garrison = Math.max(0, f.garrison - Math.floor(party * 0.4));
    events.push({ type: "assaultFailed", fort: fe.id, by: ship.id, lost });
  }
};
