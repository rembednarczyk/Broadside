import { type MountKind } from "./ship-classes";

/**
 * Ammunition as data (Type Object + Strategy: each kind carries its own multipliers, the combat
 * rules stay one function). Period shot types: round, double-shotted "heavy", chain and bar shot
 * for rigging, grape for crews, heated shot for fires, explosive shells for mortars; plus the
 * specials: fire barrels and drifting mines dropped astern, Greek fire (an Overboard! homage) and
 * Congreve rockets (its lightning).
 */
export type AmmoId = "round" | "heavy" | "chain" | "grape" | "hot" | "shell" | "fireBarrel" | "mine" | "greekFire" | "rocket";

export interface AmmoDef {
  readonly id: AmmoId;
  readonly mounts: readonly MountKind[] | readonly ["astern"];
  /** Muzzle speed multiplier (range). */
  readonly speed: number;
  /** Shot mass multiplier (penetration and damage). */
  readonly mass: number;
  readonly hull: number;
  readonly sails: number;
  readonly rigging: number;
  readonly crew: number;
  /** Chance to start a fire on a hit. */
  readonly fire: number;
  /** Extra angular spread in radians. */
  readonly spread: number;
  /** Reload time multiplier. */
  readonly reload: number;
  /** Projectiles per gun (grape fires a cloud). */
  readonly pellets: number;
  /** Explosion radius in metres (0 = solid shot). */
  readonly blast: number;
  /** Price per gun load in a port. */
  readonly price: number;
}

const solid = { pellets: 1, blast: 0 } as const;

export const AMMO: Readonly<Record<AmmoId, AmmoDef>> = {
  round: { id: "round", mounts: ["broadside", "bowChaser", "sternChaser"], speed: 1, mass: 1, hull: 1, sails: 0.4, rigging: 0.3, crew: 0.5, fire: 0.02, spread: 0.01, reload: 1, price: 2, ...solid },
  heavy: { id: "heavy", mounts: ["broadside"], speed: 0.82, mass: 1.6, hull: 1.7, sails: 0.3, rigging: 0.2, crew: 0.6, fire: 0.03, spread: 0.015, reload: 1.45, price: 4, ...solid },
  chain: { id: "chain", mounts: ["broadside", "bowChaser"], speed: 0.9, mass: 0.9, hull: 0.25, sails: 2.4, rigging: 2.2, crew: 0.4, fire: 0, spread: 0.02, reload: 1.15, price: 3, ...solid },
  grape: { id: "grape", mounts: ["broadside", "swivel"], speed: 0.85, mass: 0.12, hull: 0.08, sails: 0.5, rigging: 0.3, crew: 2.8, fire: 0, spread: 0.06, reload: 0.9, price: 3, pellets: 6, blast: 0 },
  hot: { id: "hot", mounts: ["broadside", "bowChaser", "sternChaser"], speed: 0.95, mass: 1, hull: 0.8, sails: 0.6, rigging: 0.3, crew: 0.4, fire: 0.45, spread: 0.012, reload: 1.6, price: 5, ...solid },
  shell: { id: "shell", mounts: ["mortar"], speed: 1, mass: 1, hull: 1.4, sails: 0.8, rigging: 0.8, crew: 1.6, fire: 0.3, spread: 0.03, reload: 1, price: 12, pellets: 1, blast: 9 },
  fireBarrel: { id: "fireBarrel", mounts: ["astern"], speed: 0, mass: 1, hull: 0.6, sails: 0.8, rigging: 0.4, crew: 0.8, fire: 0.9, spread: 0, reload: 1, price: 8, pellets: 1, blast: 7 },
  mine: { id: "mine", mounts: ["astern"], speed: 0, mass: 1, hull: 2.2, sails: 0.2, rigging: 0.2, crew: 1, fire: 0.25, spread: 0, reload: 1, price: 10, pellets: 1, blast: 6 },
  greekFire: { id: "greekFire", mounts: ["bowChaser"], speed: 0.18, mass: 0.05, hull: 0.15, sails: 1.2, rigging: 0.5, crew: 1.2, fire: 0.6, spread: 0.12, reload: 0.2, price: 6, pellets: 3, blast: 0 },
  rocket: { id: "rocket", mounts: ["swivel"], speed: 0.8, mass: 0.6, hull: 0.6, sails: 1.5, rigging: 0.8, crew: 0.8, fire: 0.55, spread: 0.05, reload: 2.2, price: 9, pellets: 1, blast: 4 },
};

export const AMMO_IDS = Object.keys(AMMO) as AmmoId[];

/** Base muzzle speed of a gun in m/s (game scale: a long gun reaches ~400 m flat, ~1 km at 45 deg). */
export const MUZZLE_SPEED = 110;
export const MORTAR_SPEED = 95;

export const canFire = (ammo: AmmoId, mount: MountKind): boolean => (AMMO[ammo].mounts as readonly string[]).includes(mount);

/** Reload seconds of one gun: bigger guns are slower, a full gun crew is faster. */
export const reloadSeconds = (pounder: number, ammo: AmmoId, crewShare: number): number => {
  const base = 6 + Math.sqrt(pounder) * 1.6;
  return (base * AMMO[ammo].reload) / Math.max(0.25, Math.min(1.2, crewShare));
};

/** Shot mass in kilograms. */
export const shotMass = (pounder: number, ammo: AmmoId): number => pounder * 0.4536 * AMMO[ammo].mass;
