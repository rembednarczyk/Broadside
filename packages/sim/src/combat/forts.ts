import { type Screen, screens, smokeBetween } from "./smoke";
import { type EventQueue, type FortSite, type Rng, type Vec3, FORT_CLASSES, FORT_DEPRESSION, FORT_RANGE, MORTAR_RANGE, type Relations, isHostile, standing, vec3, impactEnergy, DAMAGE_PER_JOULE, AMMO, fortLayout, fortToWorld, fortFacing, strikeFort, gauss, wrapAngle, type FortStrike } from "@broadside/core";
import { type Entity, type FortState } from "../world/components";
import { type SimWorld } from "../world/world";
import { elevationForRange, MORTAR_ELEVATION, mortarCharge, muzzleSpeed, timeOfFlight } from "./aim";
import { launchShot } from "./gunnery";

/**
 * Shore forts: batteries that fire on hostile (or provoking) ships in range, take damage through
 * their stone (armour), lose guns and mortars to hits, fall silent when the last piece is down and
 * can then be stormed by a landing party.
 *
 * Gunnery (beta test 22.11, decyzje 22.11): each gun fires from its embrasure in the class layout
 * (core/world/fort-layout) and only within 60 deg of its wall's outward normal (a gun in an
 * embrasure trains little; Vauban's works were laid out so faces flanked each other). A salvo goes
 * by divisions: the guns of a division ripple a fraction of a second apart, then the battery pauses
 * 1.5–2 s, as a ship's rolling broadside (gunnery RIPPLE). The range is taken from the muzzle, not
 * the fort's centre, and each division carries one error of laying drawn as it opens: range
 * sigma = 10 m + 5% of the range, bearing sigma = 0.012 rad (the dispersion of the period's
 * shore batteries against a ship under way: about a third of the shot struck a frigate at
 * 200 m; H. Douglas, "A Treatise on Naval Gunnery", 1855, practice tables). Before, the whole fort
 * fired from one point on its rim, a fort's radius beyond the aim, and struck 95–100% of the time.
 */
export const createFort = (site: FortSite): FortState => {
  const def = FORT_CLASSES[site.classId];
  const l = fortLayout(def);
  return {
    def,
    site,
    faction: site.faction,
    hp: def.hp,
    guns: Array.from({ length: def.guns }, () => 0),
    mortars: Array.from({ length: def.mortars }, () => 0),
    garrison: def.garrison,
    provokedBy: null,
    silenced: false,
    volley: 0,
    division: 0,
    lay: { range: 0, bearing: 0 },
    scars: Array.from({ length: l.walls.length + l.towers.length }, () => 0),
    chain: def.chain && site.chain ? CHAIN_HITS : 0,
    furnace: def.furnace,
    barredAt: -100,
  };
};

/** Hits of round shot that part a harbour chain (chain shot counts three). */
export const CHAIN_HITS = 8;
/** Below this share of its walls a fort's furnace is out (the stokers driven off, the grates wrecked). */
const FURNACE_OUT = 0.5;

/** The ammunition a fort's guns fire now: heated shot only while the furnace burns. */
export const fortAmmo = (f: FortState): FortState["def"]["ammo"] => (f.def.ammo === "hot" && !f.furnace ? "round" : f.def.ammo);

const RELOAD = 20;
const MORTAR_RELOAD = 22;
/** Seconds between the guns of a division, and the pause between divisions. */
const GUN_RIPPLE = 0.12;
const DIVISION_PAUSE = 1.5;
/** How far either side of its embrasure's normal a fort gun bears (radians). */
const GUN_ARC = Math.PI / 3;
/** Error of laying per division (one standard deviation). */
const LAY_RANGE_BASE = 10;
const LAY_RANGE_SHARE = 0.1;
const LAY_BEARING = 0.02;
/** Height the gunners lay for: a ship's side above the water. */
const AIM_ABOVE_WATER = 1.5;

export const fortCentre = (f: FortState): Vec3 => vec3(f.site.x, f.site.y + f.def.height * 0.5, f.site.z);

/** Pieces still mounted, guns and mortars. */
export const piecesLeft = (f: FortState): { guns: number; mortars: number } => ({ guns: f.guns.filter((g) => g >= 0).length, mortars: f.mortars.filter((m) => m >= 0).length });

const targetOf = (f: FortState, ships: readonly Entity[], rel: Relations | null, smoke: readonly Screen[], sight: number): { e: Entity; range: number } | null => {
  let best: { e: Entity; range: number } | null = null;
  const reach = MORTAR_RANGE * sight;
  for (const e of ships) {
    const s = e.ship!;
    if (s.sinking || s.struck) continue;
    if (e.id !== f.provokedBy && !isHostile(standing(f.faction, s.faction, rel))) continue;
    const r = Math.hypot(e.body!.pos.x - f.site.x, e.body!.pos.z - f.site.z);
    if (r >= reach || (best && r >= best.range)) continue;
    if (smokeBetween(smoke, f.site.x, f.site.z, e.body!.pos.x, e.body!.pos.z)) continue;
    best = { e, range: r };
  }
  return best;
};

/** The loaded gun that bears best on a point (world), with its muzzle and bearing to it, or null. */
const gunFor = (f: FortState, tx: number, tz: number): { i: number; muzzle: Vec3; bearing: number } | null => {
  const l = fortLayout(f.def);
  const facing = fortFacing(f.site);
  let best: { i: number; muzzle: Vec3; bearing: number; off: number } | null = null;
  l.guns.forEach((g, i) => {
    if (f.guns[i] !== 0) return;
    const m = fortToWorld(f.site, g.x + Math.sin(g.angle) * 1.2, g.y, g.z + Math.cos(g.angle) * 1.2);
    const bearing = Math.atan2(tx - m.x, tz - m.z);
    const off = Math.abs(wrapAngle(bearing - (g.angle + facing)));
    if (off <= GUN_ARC && (!best || off < best.off)) best = { i, muzzle: vec3(m.x, m.y, m.z), bearing, off };
  });
  return best;
};

/** Where a target will be after `tof` seconds (it holds its course and speed). */
const ahead = (e: Entity, tof: number): { x: number; z: number } => ({ x: e.body!.pos.x + e.body!.vel.x * tof, z: e.body!.pos.z + e.body!.vel.z * tof });

const fireGun = (world: SimWorld, events: EventQueue, fe: Entity, target: Entity, rng: Rng): boolean => {
  const f = fe.fort!;
  const tp = target.body!.pos;
  const aimY = tp.y + AIM_ABOVE_WATER;
  const first = gunFor(f, tp.x, tp.z);
  if (!first) return false;
  // Lead the target by the shot's time of flight from this muzzle, then lay on the led point.
  const h = first.muzzle.y - aimY;
  const ammo = fortAmmo(f);
  const r0 = Math.hypot(tp.x - first.muzzle.x, tp.z - first.muzzle.z);
  const led = ahead(target, timeOfFlight(r0, f.def.pounder, ammo, h, FORT_DEPRESSION));
  const range = Math.hypot(led.x - first.muzzle.x, led.z - first.muzzle.z);
  if (range > FORT_RANGE) return false;
  if (f.division === 0) f.lay = { range: gauss(rng) * (LAY_RANGE_BASE + LAY_RANGE_SHARE * range), bearing: gauss(rng) * LAY_BEARING };
  const bearing = Math.atan2(led.x - first.muzzle.x, led.z - first.muzzle.z) + f.lay.bearing;
  const elev = elevationForRange(Math.max(10, range + f.lay.range), f.def.pounder, ammo, h, FORT_DEPRESSION);
  const dir = vec3(Math.sin(bearing) * Math.cos(elev), Math.sin(elev), Math.cos(bearing) * Math.cos(elev));
  launchShot(world, fe.id, first.muzzle, dir, muzzleSpeed(ammo, false), f.def.pounder, ammo, rng);
  events.push({ type: "gunFired", ship: fe.id, at: first.muzzle, dir, pounder: f.def.pounder, ammo });
  f.guns[first.i] = RELOAD * (0.8 + rng.next() * 0.4);
  f.division++;
  if (f.division >= f.def.salvo) {
    f.division = 0;
    f.volley = DIVISION_PAUSE + rng.next() * 0.5;
  } else f.volley = GUN_RIPPLE + rng.next() * 0.08;
  return true;
};

const SHELL = 130;

const fireMortars = (world: SimWorld, events: EventQueue, fe: Entity, target: Entity, rng: Rng): void => {
  const f = fe.fort!;
  const l = fortLayout(f.def);
  const tp = target.body!.pos;
  f.mortars.forEach((m, i) => {
    const bed = l.mortars[i];
    if (m !== 0 || !bed) return;
    const at = fortToWorld(f.site, bed.x, bed.y, bed.z);
    const h = at.y - tp.y;
    // Lead by the shell's own time of flight (about 12 s at 45 deg), found from the charge table twice.
    let led = { x: tp.x, z: tp.z };
    for (let k = 0; k < 2; k++) led = ahead(target, mortarCharge(Math.hypot(led.x - at.x, led.z - at.z), h, SHELL).time);
    const range = Math.hypot(led.x - at.x, led.z - at.z);
    if (range < 150 || range > MORTAR_RANGE) return;
    const bearing = Math.atan2(led.x - at.x, led.z - at.z);
    const speed = mortarCharge(range, h, SHELL).speed;
    const dir = vec3(Math.sin(bearing) * Math.cos(MORTAR_ELEVATION), Math.sin(MORTAR_ELEVATION), Math.cos(bearing) * Math.cos(MORTAR_ELEVATION));
    const muzzle = vec3(at.x, at.y + 1, at.z);
    launchShot(world, fe.id, muzzle, dir, speed, SHELL, "shell", rng);
    events.push({ type: "gunFired", ship: fe.id, at: muzzle, dir, pounder: SHELL, ammo: "shell" });
    f.mortars[i] = MORTAR_RELOAD * (0.9 + rng.next() * 0.2);
  });
};

/** `sight` 0..1: share of the lookout's range left by fog and darkness (core sightShare). */
export const updateFort = (world: SimWorld, events: EventQueue, fe: Entity, ships: readonly Entity[], dt: number, rng: Rng, rel: Relations | null = null, sight = 1): void => {
  const f = fe.fort!;
  f.guns = f.guns.map((g) => (g > 0 ? Math.max(0, g - dt) : g));
  f.mortars = f.mortars.map((g) => (g > 0 ? Math.max(0, g - dt) : g));
  f.volley = Math.max(0, f.volley - dt);
  if (f.silenced) return;
  const t = targetOf(f, ships, rel, screens(world), sight);
  if (!t) return;
  if (f.volley === 0 && t.range < FORT_RANGE + f.def.radius) fireGun(world, events, fe, t.e, rng);
  fireMortars(world, events, fe, t.e, rng);
};

/** Segment against the fort's walls and towers (the layout's boxes and cylinders). */
export const hitsFort = (f: FortState, from: Vec3, to: Vec3): FortStrike | null => strikeFort(f.def, f.site, from, to);

/** Chance a hit dismounts a piece: damage against one piece's share of the walls, times this. */
const DISMOUNT = 0.6;

/** A hit on the walls: stone takes part of the blow; enough damage dismounts a gun or a mortar. */
export const damageFort = (events: EventQueue, fe: Entity, by: number, mass: number, speed: number, ammoId: keyof typeof AMMO, at: Vec3, rng: Rng, strike: FortStrike | null = null): void => {
  const f = fe.fort!;
  const dmg = impactEnergy(mass, speed) * DAMAGE_PER_JOULE * f.def.armour * (AMMO[ammoId].hull + AMMO[ammoId].blast * 0.15);
  f.hp = Math.max(0, f.hp - dmg);
  f.provokedBy = by;
  if (strike) {
    const k = strike.kind === "wall" ? strike.index : fortLayout(f.def).walls.length + strike.index;
    if (f.scars[k] !== undefined) f.scars[k]! += dmg;
  }
  events.push({ type: "hit", ship: fe.id, by, at, part: "wall", damage: dmg });
  // Guns and mortars are one pool (beta test 22.11: the mortars could not be knocked out, so a fort
  // with every gun down never fell silent).
  const pieces = f.def.guns + f.def.mortars;
  const perPiece = f.def.hp / Math.max(1, pieces);
  if (rng.next() < Math.min(0.9, (dmg / perPiece) * DISMOUNT)) {
    const alive = [...f.guns.map((g, i) => ({ g, i, mortar: false })), ...f.mortars.map((g, i) => ({ g, i, mortar: true }))].filter((x) => x.g >= 0);
    const pickIt = alive[Math.floor(rng.next() * alive.length)];
    if (pickIt?.mortar) f.mortars[pickIt.i] = -1;
    else if (pickIt) f.guns[pickIt.i] = -1;
  }
  if (f.furnace && f.hp < f.def.hp * FURNACE_OUT) {
    f.furnace = false;
    events.push({ type: "furnaceOut", fort: fe.id });
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

/** Share of the crew a ship lands to storm a fort. */
export const STORM_SHARE = 0.66;
/** Each defender counts as this many attackers (walls, a prepared defence). */
export const DEFENCE_FACTOR = 1.4;

/**
 * Chance a storming party carries the fort: its strength is the party times a uniform 0.8–1.2,
 * against the garrison times the defence factor, so P = clamp((1.2 - 1.4 g / d) / 0.4, 0, 1)
 * for a party d against a garrison g (the HUD shows it before the order).
 */
export const stormChance = (party: number, garrison: number): number => (party <= 0 ? 0 : Math.max(0, Math.min(1, (1.2 - (DEFENCE_FACTOR * garrison) / party) / 0.4)));

/** Storming party: up to two thirds of the crew against the garrison (Lanchester-style ratio). */
export const assault = (events: EventQueue, ship: Entity, fe: Entity, rng: Rng, onCapture: (gold: number) => void = () => {}): void => {
  const f = fe.fort!;
  const s = ship.ship!;
  if (!f.silenced) return;
  const d = Math.hypot(ship.body!.pos.x - f.site.x, ship.body!.pos.z - f.site.z);
  if (d > f.def.radius + 200) return;
  const party = Math.floor(s.crew * STORM_SHARE);
  const strength = party * (0.8 + rng.next() * 0.4);
  const defence = f.garrison * DEFENCE_FACTOR;
  if (strength > defence) {
    const lost = Math.min(party, Math.ceil((defence / strength) * party * 0.5));
    s.crew -= lost;
    const from = f.faction;
    f.faction = s.faction;
    f.garrison = Math.max(10, Math.floor((party - lost) * 0.3));
    s.crew -= Math.min(s.crew, f.garrison);
    // The new owner remounts what is left (beta test 22.11: the mortars stayed dismounted for good).
    f.guns = f.guns.map(() => 0);
    f.mortars = f.mortars.map(() => 0);
    // The new owner relights the furnace and hauls the chain up again for her own harbour.
    f.furnace = f.def.furnace;
    f.chain = f.def.chain && f.site.chain ? CHAIN_HITS : 0;
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
