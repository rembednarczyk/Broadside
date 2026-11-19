import { type AmmoId, type EventQueue, type HitPart, type Rng, type Vec3, AMMO, DAMAGE_PER_JOULE, impactEnergy, refit } from "@broadside/core";
import { type Entity } from "../world/components";
import { type ShipState, sectionIndex } from "../ship/ship-state";
import { overboard } from "./crew";
import { type SimWorld } from "../world/world";

/**
 * Damage rules of a hit. Hull hits damage a section (zone by length, side by x), hole it below
 * the waterline (a leak), kill gun crews with splinters and can dismount a gun or start a fire.
 * Rig hits tear sails and rigging and can strike a mast. Multipliers come from the ammunition
 * (Strategy as data, `core/data/ammo.ts`).
 */
export interface Impact {
  readonly ammo: AmmoId;
  readonly mass: number;
  readonly speed: number;
  readonly by: number;
  /** Hull space point of the hit. */
  readonly local: Vec3;
  readonly world: Vec3;
  readonly where: "hull" | "rig";
  /** 0..1 how nearly along the target's length the ball travelled (raking fire through bow or stern). */
  readonly raking?: number;
}

const zoneOf = (s: ShipState, z: number): 0 | 1 | 2 => {
  const L = s.model.def.hull.length;
  return z > L / 6 ? 0 : z < -L / 6 ? 2 : 1;
};

/** Leak per point of damage below the waterline (m^3/s). */
const LEAK_PER_DAMAGE = 0.0016;

const hullHit = (s: ShipState, imp: Impact, dmg: number, rng: Rng, events: EventQueue, shipId: number): HitPart => {
  const a = AMMO[imp.ammo];
  const sec = s.sections[sectionIndex(zoneOf(s, imp.local.z), imp.local.x > 0)]!;
  sec.hp = Math.max(0, sec.hp - dmg * a.hull * refit(s.upgrades, "hullDamage"));
  if (imp.local.y < 0.5) sec.leak += dmg * a.hull * LEAK_PER_DAMAGE * (imp.local.y < 0 ? 1.4 : 0.6);
  // Splinters: the deadliest effect of round shot on crews.
  const killed = Math.min(s.crew, Math.floor(dmg * a.crew * 0.12 + rng.next()));
  s.crew -= killed;
  if (a.fire > 0 && rng.next() < a.fire) {
    if (sec.fire === 0) events.push({ type: "fireStarted", ship: shipId, section: s.sections.indexOf(sec) });
    sec.fire = Math.max(sec.fire, 0.25);
  }
  const deck = imp.local.y > s.model.def.hull.freeboard * 0.4;
  if (deck && rng.next() < 0.06 * a.hull) {
    const side = imp.local.x > 0 ? "starboard" : "port";
    const near = s.model.guns.map((g, i) => ({ g, i })).filter(({ g, i }) => g.side === side && !s.guns[i]!.dismounted);
    const pick = near[Math.floor(rng.next() * near.length)];
    if (pick) {
      s.guns[pick.i]!.dismounted = true;
      return "gun";
    }
  }
  return killed > 0 && a.crew > 1.5 ? "crew" : "hull";
};

/** Mast strength of the ship whose canvas and rigging the damage rates are set for (a brig's). */
const RIG_MEASURE = 240;
/** Share of the canvas and of the rigging a unit of damage takes (weighted by the shot's sails and rigging factors). */
const CLOTH_DAMAGE = 0.0013;
const RIG_DAMAGE = 0.0004;

const rigHit = (s: ShipState, imp: Impact, dmg: number, rng: Rng, events: EventQueue, shipId: number): HitPart => {
  const a = AMMO[imp.ammo];
  let mast = 0;
  let best = Infinity;
  s.model.def.masts.forEach((m, i) => {
    const d = Math.abs(m.z - imp.local.z);
    if (d < best && s.mastHp[i]! > 0) {
      best = d;
      mast = i;
    }
  });
  // Canvas and rigging are shares of the whole: a hit takes less of a big ship's (her spars and
  // gear in proportion to her masts' strength, a brig the measure). Before, one salvo of chain
  // took 83% of any ship's rigging, a liner's as a schooner's, and settled every fight (beta 19.11).
  const size = RIG_MEASURE / s.model.def.mastHp;
  s.sailCloth[mast] = Math.max(0, s.sailCloth[mast]! - dmg * a.sails * CLOTH_DAMAGE * size);
  s.rigging = Math.max(0, s.rigging - dmg * a.rigging * RIG_DAMAGE * size);
  s.crew -= Math.min(s.crew, Math.floor(dmg * a.crew * 0.03 + rng.next() * 0.5));
  if (Math.abs(imp.local.x) < 1.2 && best < 1.5) {
    s.mastHp[mast] = Math.max(0, s.mastHp[mast]! - dmg * (0.6 + a.rigging * 0.4));
    if (s.mastHp[mast] === 0) events.push({ type: "mastFell", ship: shipId, mast });
    return "mast";
  }
  return a.sails >= a.rigging ? "sails" : "rigging";
};

/** Extra hull damage and extra casualties (share of those of an ordinary hit) of a full rake. */
const RAKE_HULL = 0.5;
const RAKE_CREW = 1.5;

export const applyImpact = (world: SimWorld, events: EventQueue, e: Entity, imp: Impact, rng: Rng): void => {
  const s = e.ship!;
  // Raking fire: a ball through the stern or bow runs the length of the gun deck (the most feared
  // shot of the age of sail), so a hull hit along the length does more harm, most of it to the crew.
  const rake = imp.where === "hull" ? (imp.raking ?? 0) : 0;
  const dmg = impactEnergy(imp.mass, imp.speed) * DAMAGE_PER_JOULE * (s.braced > 0 ? 0.8 : 1) * (1 + RAKE_HULL * rake);
  const crewBefore = s.crew;
  const part = imp.where === "hull" ? hullHit(s, imp, dmg, rng, events, e.id) : rigHit(s, imp, dmg, rng, events, e.id);
  if (rake > 0) s.crew = Math.max(0, s.crew - Math.floor((crewBefore - s.crew) * RAKE_CREW * rake));
  s.lastHitBy = imp.by;
  events.push({ type: "hit", ship: e.id, by: imp.by, at: imp.world, part, damage: dmg });
  // A heavy hit throws men into the sea (Overboard!): some of the casualties are swimmers.
  const lost = crewBefore - s.crew;
  if (lost >= 2 && rng.next() < 0.5) overboard(world, events, e, Math.ceil(lost * 0.4), rng);
};

/** Area damage of a shell, a mine or a fire barrel: every ship within the radius, falling off linearly. */
export const applyBlast = (world: SimWorld, events: EventQueue, at: Vec3, radius: number, ammo: AmmoId, by: number, rng: Rng): void => {
  events.push({ type: "explosion", at, radius });
  for (const e of world.with("ship", "body")) {
    const p = e.body.pos;
    const d = Math.hypot(p.x - at.x, p.z - at.z) - e.ship.model.def.hull.beam / 2;
    if (d > radius) continue;
    const fall = 1 - Math.max(0, d) / radius;
    const local = { x: at.x > p.x ? 1 : -1, y: at.y - p.y + e.ship.model.com.y, z: 0 };
    applyImpact(world, events, e, { ammo, mass: 40 * fall, speed: 60, by, local, world: at, where: at.y - p.y > e.ship.model.def.hull.freeboard + 2 ? "rig" : "hull" }, rng);
  }
};
