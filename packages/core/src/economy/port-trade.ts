import { type AmmoId, AMMO } from "../data/ammo";
import { type Faction, isHostile, startStanding } from "../data/factions";

/**
 * Port services and their prices (rules as pure functions, so the economy is tested apart from
 * the world). A pirate haven trades with anyone at a premium; a nation's port refuses a captain
 * at war with it; friends get a discount.
 */
export type PortService = "ammo" | "crew" | "repair" | "provisions" | "sellPlunder";

export const BASE_PRICES = {
  /** Gold per seaman hired. */
  crew: 12,
  /** Gold per hit point of hull repaired. */
  hull: 0.5,
  /** Gold per hit point of mast repaired. */
  mast: 1.2,
  /** Gold per share (0..1) of a mast's canvas replaced, per square metre of sail. */
  canvas: 0.4,
  /** Gold per share of rigging, per crew member of the ship's complement (bigger ships, more rope). */
  rigging: 3,
  /** Gold per man per day of provisions. */
  provisions: 0.15,
} as const;

export const priceFactor = (port: Faction, captain: Faction): number | null => {
  if (port === "pirates") return 1.35;
  const standing = startStanding(port, captain);
  if (isHostile(standing)) return null;
  return standing > 0.4 ? 0.85 : 1;
};

export const ammoPrice = (ammo: AmmoId, loads: number, factor: number): number => Math.ceil(AMMO[ammo].price * loads * factor);
export const crewPrice = (men: number, factor: number): number => Math.ceil(BASE_PRICES.crew * men * factor);
export const provisionsPrice = (men: number, days: number, factor: number): number => Math.ceil(BASE_PRICES.provisions * men * days * factor);

export interface RepairBill {
  readonly hull: number;
  readonly masts: number;
  readonly canvas: number;
  readonly rigging: number;
  readonly total: number;
}

/** What a full repair costs, given the damage (hit points missing, sail and rigging shares lost). */
export const repairBill = (hullMissing: number, mastMissing: number, canvasMissing: number, sailArea: number, riggingMissing: number, complement: number, factor: number): RepairBill => {
  const hull = Math.ceil(hullMissing * BASE_PRICES.hull * factor);
  const masts = Math.ceil(mastMissing * BASE_PRICES.mast * factor);
  const canvas = Math.ceil(canvasMissing * sailArea * BASE_PRICES.canvas * factor);
  const rigging = Math.ceil(riggingMissing * complement * BASE_PRICES.rigging * factor);
  return { hull, masts, canvas, rigging, total: hull + masts + canvas + rigging };
};

/** Plunder sells for its value, less the fence's cut in a pirate haven. */
export const plunderValue = (value: number, port: Faction): number => Math.floor(value * (port === "pirates" ? 0.8 : 1));

/** Prize money for sinking or taking a ship: a share of her price (plus what was aboard). */
export const prizeMoney = (shipPrice: number, taken: boolean): number => Math.floor(shipPrice * (taken ? 0.3 : 0.08));
