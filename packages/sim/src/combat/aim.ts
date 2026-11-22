import { type AmmoId, MORTAR_SPEED, MUZZLE_SPEED, AMMO, SHIP_DEPRESSION, dragFactor, elevationFor, flight, shotMass, speedFor } from "@broadside/core";

/**
 * Gun laying from a range (the gunner's range table): the elevation for a range is found once
 * and memoised by rounded range, pounder, ammunition and deck height (Memoization; the period
 * equivalent was a printed range table).
 */
const MAX_ELEVATION = 0.26;
const table = new Map<string, number>();

export const muzzleSpeed = (ammo: AmmoId, mortar: boolean): number => (mortar ? MORTAR_SPEED : MUZZLE_SPEED) * AMMO[ammo].speed;

export const elevationForRange = (range: number, pounder: number, ammo: AmmoId, height: number, minElevation = SHIP_DEPRESSION): number => {
  const r = Math.max(10, Math.round(range / 5) * 5);
  // Launch height above the aim point; negative when aiming up at a fort's walls.
  const h = Math.round(height * 2) / 2;
  const key = `${r}|${pounder}|${ammo}|${h}|${minElevation}`;
  let e = table.get(key);
  if (e === undefined) {
    const m = shotMass(pounder, ammo);
    e = elevationFor(r, muzzleSpeed(ammo, false), h, dragFactor(m), MAX_ELEVATION, minElevation);
    table.set(key, e);
  }
  return e;
};

/** Seconds a gun's shot flies to a range (for leading a moving target), from the same table. */
export const timeOfFlight = (range: number, pounder: number, ammo: AmmoId, height: number, minElevation = SHIP_DEPRESSION): number => {
  const r = Math.max(10, Math.round(range / 10) * 10);
  const h = Math.round(height);
  const key = `t|${r}|${pounder}|${ammo}|${h}|${minElevation}`;
  let t = table.get(key);
  if (t === undefined) {
    const k = dragFactor(shotMass(pounder, ammo));
    t = flight(muzzleSpeed(ammo, false), elevationForRange(r, pounder, ammo, h, minElevation), h, k).time;
    table.set(key, t);
  }
  return t;
};

/**
 * Mortars fire at a fixed high angle (45 deg) and set the range with the powder charge: the
 * charge table gives the launch speed for a range and a height above the target, flown with the
 * shell's air drag (memoised by rounded range and height, like the gun table). Beta test 22.11:
 * the drag-free formula v = sqrt(g d / sin 2a) and the flat-water assumption threw the shells
 * 20–40 m long at 300–400 m and short at 700–790 m.
 */
export const MORTAR_ELEVATION = Math.PI / 4;
const SHELL_POUNDER = 130;

const shellDrag = (pounder: number): number => dragFactor(shotMass(pounder, "shell"));

export const mortarCharge = (range: number, height: number, pounder = SHELL_POUNDER): { speed: number; time: number } => {
  const r = Math.max(40, Math.round(range / 5) * 5);
  const h = Math.round(height);
  const key = `m|${r}|${h}|${pounder}`;
  let v = table.get(key);
  if (v === undefined) {
    v = speedFor(r, MORTAR_ELEVATION, h, shellDrag(pounder), MORTAR_SPEED);
    table.set(key, v);
  }
  const tk = `mt|${r}|${h}|${pounder}`;
  let t = table.get(tk);
  if (t === undefined) {
    t = flight(v, MORTAR_ELEVATION, h, shellDrag(pounder)).time;
    table.set(tk, t);
  }
  return { speed: v, time: t };
};
