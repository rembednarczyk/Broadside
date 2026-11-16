import { type AmmoId, MORTAR_SPEED, MUZZLE_SPEED, AMMO, dragFactor, elevationFor, shotMass } from "@broadside/core";

/**
 * Gun laying from a range (the gunner's range table): the elevation for a range is found once
 * and memoised by rounded range, pounder, ammunition and deck height (Memoization; the period
 * equivalent was a printed range table).
 */
const MAX_ELEVATION = 0.26;
const table = new Map<string, number>();

export const muzzleSpeed = (ammo: AmmoId, mortar: boolean): number => (mortar ? MORTAR_SPEED : MUZZLE_SPEED) * AMMO[ammo].speed;

export const elevationForRange = (range: number, pounder: number, ammo: AmmoId, height: number): number => {
  const r = Math.max(10, Math.round(range / 5) * 5);
  // Launch height above the aim point; negative when aiming up at a fort's walls.
  const h = Math.round(height * 2) / 2;
  const key = `${r}|${pounder}|${ammo}|${h}`;
  let e = table.get(key);
  if (e === undefined) {
    const m = shotMass(pounder, ammo);
    e = elevationFor(r, muzzleSpeed(ammo, false), h, dragFactor(m), MAX_ELEVATION);
    table.set(key, e);
  }
  return e;
};

/**
 * Mortars fire at a fixed high angle (45 deg) and set the range with the powder charge: the speed
 * for a range on flat water without drag, v = sqrt(g d / sin 2a), capped at full charge.
 */
export const MORTAR_ELEVATION = Math.PI / 4;
export const mortarSpeed = (range: number): number => Math.min(MORTAR_SPEED, Math.sqrt((9.81 * Math.max(40, range)) / Math.sin(2 * MORTAR_ELEVATION)));
