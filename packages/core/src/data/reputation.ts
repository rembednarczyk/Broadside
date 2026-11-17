import { type Faction, startStanding } from "./factions";

/**
 * The player's standing with each faction (-1 war .. 1 allied). Nations keep their quarrels with
 * each other fixed; only the player's standing moves. Pirates fight everyone, always.
 */
export type Relations = Record<Exclude<Faction, "player">, number>;

export const createRelations = (): Relations => ({ crown: startStanding("player", "crown"), republic: startStanding("player", "republic"), empire: startStanding("player", "empire"), pirates: -1 });

/** Standing between two factions, with the player's own standing taken from the relations. */
export const standing = (a: Faction, b: Faction, rel: Relations | null): number => {
  if (a === b || !rel) return startStanding(a, b);
  if (a === "player") return rel[b as keyof Relations];
  if (b === "player") return rel[a as keyof Relations];
  return startStanding(a, b);
};

/**
 * How deeds move standing (Type Object table). Small steps per shot so a single stray ball is
 * forgiven, large ones for sinking or taking a ship. Sinking a nation's enemy pleases the nation.
 */
export const REPUTATION = {
  /** Per hit on a ship of that nation. */
  hit: -0.02,
  /** Per hit on a fort of that nation. */
  fortHit: -0.025,
  sink: -0.4,
  capture: -0.3,
  fortCaptured: -0.6,
  /** To every nation, for each pirate sunk or taken. */
  pirate: 0.06,
  /** To nations at war with the victim's nation. */
  enemyOfEnemy: 0.1,
} as const;

const NATIONS: readonly (keyof Relations)[] = ["crown", "republic", "empire"];

/** Applies a deed against a faction's ship or fort; returns the nations whose standing moved. */
export const applyDeed = (rel: Relations, victim: Faction, delta: number): (keyof Relations)[] => {
  if (victim === "player") return [];
  const moved: (keyof Relations)[] = [];
  const shift = (f: keyof Relations, d: number): void => {
    const next = Math.max(-1, Math.min(1, rel[f] + d));
    if (next !== rel[f]) moved.push(f);
    rel[f] = next;
  };
  if (victim === "pirates") {
    if (delta <= REPUTATION.capture) for (const n of NATIONS) shift(n, REPUTATION.pirate);
    return moved;
  }
  shift(victim, delta);
  if (delta <= REPUTATION.capture) for (const n of NATIONS) if (n !== victim && startStanding(n, victim) <= -1) shift(n, REPUTATION.enemyOfEnemy);
  return moved;
};
