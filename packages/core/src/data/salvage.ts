import { createRng, hashString } from "../math/rng";

/**
 * Salvage of the wrecks on the shoals (data, Type Object): a ship that lies to beside a wreck for
 * a while sends boats over and brings back what the sea left aboard, once per wreck. The haul is
 * fixed by the world's seed and the wreck (the same wreck pays the same in every game of a seed).
 */
export const SALVAGE = {
  /** The ship must lie within this distance of the wreck (m). */
  radius: 60,
  /** ...this slowly (m/s), the boats need a ship that is not under way... */
  maxSpeed: 1.5,
  /** ...for this long (s). */
  dwell: 5,
  /** Gold brought back, between these. */
  gold: [150, 600] as const,
} as const;

/** The gold a wreck yields (deterministic from the seed and the wreck's index). */
export const salvageGold = (seed: number, wreck: number): number => {
  const u = createRng(hashString(`salvage-${seed}-${wreck}`)).next();
  return Math.round(SALVAGE.gold[0] + u * (SALVAGE.gold[1] - SALVAGE.gold[0]));
};
