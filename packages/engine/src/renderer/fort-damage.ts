import { type FortClassDef, fortLayout } from "@broadside/core";

/**
 * How battered each part of a fort's works looks, from the damage the simulation booked to it
 * (FortState.scars: per wall segment, then per tower). Discrete states with thresholds, as a
 * ship's DAMAGE_STATES (core data/damage-states, the State pattern of "Game Programming
 * Patterns" reduced to a lookup): 0 sound, 1 scarred (pockmarked, darker), 2 breached (a gap torn
 * in the wall's top, a cone of rubble at its foot; a tower loses its upper third). A part's share
 * of the fort's hit points is its length (walls) or girth (towers) against the whole.
 */
export type PartState = 0 | 1 | 2;

/** Shares of a part's hit points at which it scars and breaches. */
export const SCARRED = 0.2;
export const BREACHED = 0.6;

const sizes = (def: FortClassDef): number[] => {
  const l = fortLayout(def);
  return [...l.walls.map((w) => Math.hypot(w.x1 - w.x0, w.z1 - w.z0)), ...l.towers.map((t) => Math.PI * 2 * t.radius)];
};

const shares = new Map<FortClassDef, number[]>();

/** Each part's share of the fort's hit points. */
export const partShares = (def: FortClassDef): number[] => {
  let s = shares.get(def);
  if (!s) {
    const z = sizes(def);
    const total = z.reduce((a, b) => a + b, 0) || 1;
    s = z.map((v) => (v / total) * def.hp);
    shares.set(def, s);
  }
  return s;
};

export const partStates = (def: FortClassDef, scars: readonly number[]): PartState[] =>
  partShares(def).map((share, i) => {
    const d = (scars[i] ?? 0) / Math.max(1, share);
    return d >= BREACHED ? 2 : d >= SCARRED ? 1 : 0;
  });

/** Stone darkens with the fort's damage (soot and fresh breaks): 1 sound, 0.6 at no hit points left. */
export const stoneShade = (health: number): number => 0.6 + 0.4 * Math.max(0, Math.min(1, health));
