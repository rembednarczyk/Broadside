/**
 * Refits a yard can make to a ship (Type Object table; systems read the factors). Period refits:
 * copper sheathing kept the bottom clean of weed and worm (the Royal Navy coppered its fleet in
 * the 1780s and ships gained speed), extra riders and thicker scantlings stiffened the hull, and
 * flintlock gunlocks replaced the slow match for quicker, steadier fire.
 */
export type UpgradeId = "copper" | "riders" | "gunlocks";

export interface UpgradeDef {
  readonly id: UpgradeId;
  /** Price as a share of the ship's price. */
  readonly priceShare: number;
  /** Multipliers (1: unchanged). */
  readonly drag: number;
  readonly hullDamage: number;
  readonly spread: number;
  readonly reload: number;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  copper: { id: "copper", priceShare: 0.08, drag: 0.9, hullDamage: 1, spread: 1, reload: 1 },
  riders: { id: "riders", priceShare: 0.1, drag: 1.03, hullDamage: 0.8, spread: 1, reload: 1 },
  gunlocks: { id: "gunlocks", priceShare: 0.06, drag: 1, hullDamage: 1, spread: 0.6, reload: 0.9 },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

/** Product of one factor over the refits a ship carries. */
export const refit = (ups: readonly UpgradeId[], key: "drag" | "hullDamage" | "spread" | "reload"): number => ups.reduce((a, u) => a * UPGRADES[u][key], 1);

export const upgradePrice = (id: UpgradeId, shipPrice: number, factor: number): number => Math.ceil(shipPrice * UPGRADES[id].priceShare * factor);
