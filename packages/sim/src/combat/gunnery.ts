import { type AmmoId, type GameCommand, type MountKind, type Rng, type Vec3, AMMO, canFire, gauss, rotate, vec3, normalize, quatFromAxisAngle, add, scale, reloadSeconds, shotMass, dragFactor, refit, type EventQueue } from "@broadside/core";
import { type Entity } from "../world/components";
import { type SimWorld } from "../world/world";
import { type ShipState, crewShare } from "../ship/ship-state";
import { type GunMount } from "../ship/ship-model";
import { MORTAR_ELEVATION, elevationForRange, mortarSpeed, muzzleSpeed } from "./aim";
import { type RigidBody, addAngularImpulse, applyImpulseAt, bodyToWorld } from "../physics/rigid-body";

/**
 * Gunnery: a fire order queues every loaded gun of a battery with a short ripple delay (a
 * "rolling broadside", the period drill that spared the hull the shock of all guns at once), and
 * the guns system fires them as their fuses burn down.
 */
const RIPPLE = 0.07;
/** Base dispersion of a smoothbore (radians, one deviation). */
const BASE_SPREAD = 0.007;
/** Muzzle speed of a period smoothbore with a full charge (m/s): sets the recoil momentum. */
const REAL_MUZZLE_SPEED = 450;
/** Heeling moment of recoil scaled for readability (a broadside visibly rolls the ship away). */
const HEEL_FEEL = 3;

/** Recoil as an impulse at the gun: full linear push, heeling moment times HEEL_FEEL. */
const recoil = (b: RigidBody, impulse: Vec3, at: Vec3): void => {
  applyImpulseAt(b, impulse, at);
  const lever = vec3(at.x - b.pos.x, at.y - b.pos.y, at.z - b.pos.z);
  // Extra heeling only (no extra push): the impulse's moment about the centre of mass, scaled.
  const torque = vec3(lever.y * impulse.z - lever.z * impulse.y, lever.z * impulse.x - lever.x * impulse.z, lever.x * impulse.y - lever.y * impulse.x);
  addAngularImpulse(b, scale(torque, HEEL_FEEL - 1));
};

/** How far a gun trains in its port either side (about 8 deg); swivels and chasers further. */
const TRAIN_LIMIT = 0.3;
const TRAIN_LIMIT_FREE = 0.6;

const matches = (g: GunMount, mount: MountKind, side: "port" | "starboard" | undefined): boolean =>
  g.kind === mount && (side === undefined || g.side === "centre" || g.side === side);

/** Queues the guns of a battery; returns how many were queued. */
export const orderFire = (s: ShipState, mount: MountKind, side: "port" | "starboard" | undefined, range: number, rng: Rng, train = 0, aimHeight = 0): number => {
  let n = 0;
  s.model.guns.forEach((g, i) => {
    const st = s.guns[i]!;
    if (!matches(g, mount, side) || st.dismounted || st.reload > 0 || st.fuse >= 0) return;
    if ((s.stores[st.ammo] ?? 0) <= 0) return;
    st.fuse = n * RIPPLE + rng.next() * 0.03;
    st.elevation = g.kind === "mortar" ? range : elevationForRange(range, g.pounder, st.ammo, g.pos.y + s.model.com.y - aimHeight);
    const limit = g.kind === "broadside" ? TRAIN_LIMIT : TRAIN_LIMIT_FREE;
    st.train = Math.max(-limit, Math.min(limit, train));
    n++;
  });
  return n;
};

export const loadAmmo = (s: ShipState, mount: MountKind, ammo: AmmoId): void => {
  if (!canFire(ammo, mount)) return;
  s.ammoLoad[mount] = ammo;
  s.model.guns.forEach((g, i) => {
    const st = s.guns[i]!;
    if (g.kind !== mount || st.ammo === ammo) return;
    st.ammo = ammo;
    // Drawing a charge and reloading with the new shot takes a full reload.
    st.reload = reloadSeconds(g.pounder, ammo, crewShare(s));
    st.fuse = -1;
  });
};

/**
 * Puts one round in flight (all pellets of a load) from a muzzle along a world direction; shared
 * by ships' guns and forts' batteries. Returns the shot mass per pellet.
 */
export const launchShot = (world: SimWorld, owner: number, muzzle: Vec3, dir: Vec3, speed: number, pounder: number, ammo: AmmoId, rng: Rng, carrier: Vec3 = vec3(0, 0, 0), steadiness = 1): number => {
  const def = AMMO[ammo];
  const mass = shotMass(pounder, ammo) / def.pellets;
  for (let p = 0; p < def.pellets; p++) {
    const spread = (BASE_SPREAD + def.spread) * steadiness;
    const d = normalize(add(dir, vec3(gauss(rng) * spread, gauss(rng) * spread * 0.6, gauss(rng) * spread)));
    world.add({
      id: 0,
      shot: {
        s: { x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: carrier.x + d.x * speed, vy: carrier.y + d.y * speed, vz: carrier.z + d.z * speed },
        k: dragFactor(mass, ammo === "chain" ? 0.9 : 0.47),
        mass,
        ammo,
        owner,
        pounder,
        age: 0,
        bounces: 0,
      },
    });
  }
  return mass;
};

const spawnShot = (world: SimWorld, events: EventQueue, e: Entity, g: GunMount, gi: number, rng: Rng): void => {
  const s = e.ship!;
  const b = e.body!;
  const st = s.guns[gi]!;
  const ammo = AMMO[st.ammo];
  const mortar = g.kind === "mortar";
  // The gun captain lays the gun against the horizon, not the deck: the ship's heel and pitch
  // at the moment of firing are taken out (in the period, by firing on the right part of the roll).
  const tilt = Math.asin(Math.max(-1, Math.min(1, rotate(b.rot, rotate(quatFromAxisAngle(vec3(0, 1, 0), st.train), g.dir)).y)));
  const elevation = (mortar ? MORTAR_ELEVATION : st.elevation) - tilt;
  const speed = mortar ? mortarSpeed(st.elevation) : muzzleSpeed(st.ammo, false);
  // Elevate the muzzle about the horizontal axis across the bore, then into world space (the
  // ship's heel and pitch tilt the guns: firing on the up-roll carries further).
  const trained = rotate(quatFromAxisAngle(vec3(0, 1, 0), st.train), g.dir);
  const axis = normalize(vec3(trained.z, 0, -trained.x));
  const local = rotate(quatFromAxisAngle(axis, -elevation), trained);
  const muzzle = bodyToWorld(b, add(g.pos, scale(g.dir, 1.2)));
  const mass = launchShot(world, e.id, muzzle, rotate(b.rot, local), speed, g.pounder, st.ammo, rng, b.vel, refit(s.upgrades, "spread"));
  const dirWorld = rotate(b.rot, local);
  // Recoil: the shot's momentum plus the powder gases (about half again) push the ship through the
  // breeching ropes at the gun port. The momentum is the real gun's (muzzle speed of a smoothbore,
  // about 450 m/s), not the slowed ball of the game's ballistics. Fired high on one side, it heels
  // the ship away from the target; the heeling moment is scaled up for the eye (decyzje 17.11).
  recoil(b, scale(dirWorld, -mass * ammo.pellets * (mortar ? speed : REAL_MUZZLE_SPEED) * 1.5), muzzle);
  events.push({ type: "gunFired", ship: e.id, at: muzzle, dir: dirWorld, pounder: g.pounder, ammo: st.ammo });
  s.stores[st.ammo] = Math.max(0, (s.stores[st.ammo] ?? 0) - 1);
  st.reload = reloadSeconds(g.pounder, st.ammo, crewShare(s) * gunCrewShare(s)) * refit(s.upgrades, "reload");
};

/** Gun crews are thinned by casualties first in the waist (sections 2 and 3). */
const gunCrewShare = (s: ShipState): number => (s.sections[2]!.fire > 0.5 || s.sections[3]!.fire > 0.5 ? 0.6 : 1);

/** `wet` 0..1: rain dampens the powder and slows the reload (up to a third longer). */
export const updateGuns = (world: SimWorld, events: EventQueue, e: Entity, dt: number, rng: Rng, wet = 0): void => {
  const s = e.ship!;
  s.model.guns.forEach((g, i) => {
    const st = s.guns[i]!;
    if (st.reload > 0) st.reload = Math.max(0, st.reload - dt / (1 + 0.33 * wet));
    if (st.fuse < 0) return;
    st.fuse -= dt;
    if (st.fuse < 0) {
      st.fuse = -1;
      if (!st.dismounted && (s.stores[st.ammo] ?? 0) > 0 && !s.sinking) spawnShot(world, events, e, g, i, rng);
    }
  });
};

export const isFireCommand = (c: GameCommand): c is Extract<GameCommand, { type: "fire" }> => c.type === "fire";
