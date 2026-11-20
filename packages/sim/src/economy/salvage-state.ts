/**
 * Salvage state: the wrecks the player has already stripped, and how long the player
 * has lain to beside the nearest one still untouched. Lying within SALVAGE.radius at no more than
 * SALVAGE.maxSpeed for SALVAGE.dwell seconds brings its gold aboard once (core/data/salvage). Part
 * of the simulation state (saved).
 */
export interface Salvage {
  /** Indices (wreckSites order) of the wrecks already salvaged. */
  salvaged: number[];
  /** Seconds lain to beside `at` so far. */
  dwell: number;
  /** The wreck being worked (-1: none). */
  at: number;
}

export const createSalvage = (): Salvage => ({ salvaged: [], dwell: 0, at: -1 });
