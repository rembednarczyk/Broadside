import { type AmmoId, AMMO } from "../data/ammo";
import { type Faction, isHostile } from "../data/factions";
import { type Relations, standing as standingOf } from "../data/reputation";
import { type ShipClassId, SHIP_CLASSES } from "../data/ship-classes";

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

export const priceFactor = (port: Faction, captain: Faction, rel: Relations | null = null): number | null => {
  if (port === "pirates") return 1.35;
  const standing = standingOf(port, captain, rel);
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

/**
 * Shipyard. Nation yards build every class; a pirate haven sells only small, fast hulls. The old
 * ship is taken in part exchange at half its price, scaled by its condition.
 */
export const TRADE_IN = 0.5;
const PIRATE_YARD: readonly ShipClassId[] = ["cutter", "sloop", "schooner", "brig"];
const NATION_YARD: readonly ShipClassId[] = ["cutter", "gunboat", "sloop", "schooner", "brig", "bomb", "galleon", "frigate", "liner"];
export const shipyardStock = (owner: Faction): readonly ShipClassId[] => (owner === "pirates" ? PIRATE_YARD : NATION_YARD);
export const shipPrice = (id: ShipClassId, factor: number): number => Math.ceil(SHIP_CLASSES[id].price * factor);
/** `condition` 0..1: share of hull and masts left. */
export const tradeInValue = (id: ShipClassId, condition: number): number => Math.floor(SHIP_CLASSES[id].price * TRADE_IN * Math.max(0, Math.min(1, condition)));
