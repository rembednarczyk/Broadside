import { type AmmoId, type GameCommand, type MountKind, type Rng, AMMO, canFire, gauss, rotate, vec3, normalize, quatFromAxisAngle, add, scale, reloadSeconds, shotMass, dragFactor, type EventQueue } from "@broadside/core";
import { type Entity } from "../world/components";
import { type SimWorld } from "../world/world";
import { type ShipState, crewShare } from "../ship/ship-state";
import { type GunMount } from "../ship/ship-model";
import { MORTAR_ELEVATION, elevationForRange, mortarSpeed, muzzleSpeed } from "./aim";
import { bodyToWorld, applyImpulseAt } from "../physics/rigid-body";

/**
 * Gunnery: a fire order queues every loaded gun of a battery with a short ripple delay (a
 * "rolling broadside", the period drill that spared the hull the shock of all guns at once), and
 * the guns system fires them as their fuses burn down.
 */
const RIPPLE = 0.07;
/** Base dispersion of a smoothbore (radians, one deviation). */
const BASE_SPREAD = 0.007;
/** How far a gun trains in its port either side (about 8 deg); swivels and chasers further. */
const TRAIN_LIMIT = 0.14;
const TRAIN_LIMIT_FREE = 0.6;

const matches = (g: GunMount, mount: MountKind, side: "port" | "starboard" | undefined): boolean =>
  g.kind === mount && (side === undefined || g.side === "centre" || g.side === side);

/** Queues the guns of a battery; returns how many were queued. */
export const orderFire = (s: ShipState, mount: MountKind, side: "port" | "starboard" | undefined, range: number, rng: Rng, train = 0): number => {
  let n = 0;
  s.model.guns.forEach((g, i) => {
    const st = s.guns[i]!;
    if (!matches(g, mount, side) || st.dismounted || st.reload > 0 || st.fuse >= 0) return;
    if ((s.stores[st.ammo] ?? 0) <= 0) return;
    st.fuse = n * RIPPLE + rng.next() * 0.03;
    st.elevation = g.kind === "mortar" ? range : elevationForRange(range, g.pounder, st.ammo, g.pos.y + s.model.com.y);
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
  const mass = shotMass(g.pounder, st.ammo) / ammo.pellets;
  for (let p = 0; p < ammo.pellets; p++) {
    const spread = BASE_SPREAD + ammo.spread;
    const d = normalize(add(rotate(b.rot, local), vec3(gauss(rng) * spread, gauss(rng) * spread * 0.6, gauss(rng) * spread)));
    world.add({
      id: 0,
      shot: {
        s: { x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: b.vel.x + d.x * speed, vy: b.vel.y + d.y * speed, vz: b.vel.z + d.z * speed },
        k: dragFactor(mass, st.ammo === "chain" ? 0.9 : 0.47),
        mass,
        ammo: st.ammo,
        owner: e.id,
        pounder: g.pounder,
        age: 0,
        bounces: 0,
      },
    });
  }
  const dirWorld = rotate(b.rot, local);
  // Recoil: the shot's momentum plus the powder gases (about half again) push the ship.
  applyImpulseAt(b, scale(dirWorld, -mass * ammo.pellets * speed * 1.5), muzzle);
  events.push({ type: "gunFired", ship: e.id, at: muzzle, dir: dirWorld, pounder: g.pounder, ammo: st.ammo });
  s.stores[st.ammo] = Math.max(0, (s.stores[st.ammo] ?? 0) - 1);
  st.reload = reloadSeconds(g.pounder, st.ammo, crewShare(s) * gunCrewShare(s));
};

/** Gun crews are thinned by casualties first in the waist (sections 2 and 3). */
const gunCrewShare = (s: ShipState): number => (s.sections[2]!.fire > 0.5 || s.sections[3]!.fire > 0.5 ? 0.6 : 1);

export const updateGuns = (world: SimWorld, events: EventQueue, e: Entity, dt: number, rng: Rng): void => {
  const s = e.ship!;
  s.model.guns.forEach((g, i) => {
    const st = s.guns[i]!;
    if (st.reload > 0) st.reload = Math.max(0, st.reload - dt);
    if (st.fuse < 0) return;
    st.fuse -= dt;
    if (st.fuse < 0) {
      st.fuse = -1;
      if (!st.dismounted && (s.stores[st.ammo] ?? 0) > 0 && !s.sinking) spawnShot(world, events, e, g, i, rng);
    }
  });
};

export const isFireCommand = (c: GameCommand): c is Extract<GameCommand, { type: "fire" }> => c.type === "fire";
