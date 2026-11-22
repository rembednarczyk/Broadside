import { type Faction } from "../data/factions";
import { type FortClassId } from "../data/forts";

/** Where a fort stands and what it is (from the land's generator, shores fortSites). */
export interface FortSite {
  readonly x: number;
  readonly z: number;
  /** Ground height the fort stands on. */
  readonly y: number;
  readonly classId: FortClassId;
  readonly faction: Faction;
  /** Port the fort guards (index into portSites), or null for a lone work. */
  readonly port: number | null;
  /** Bearing the works face (atan2(dx, dz), towards the sea). */
  readonly facing?: number;
  /** A chain boom across the approach to its port (two ends on the water plane), for a fort that has one. */
  readonly chain?: { readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number };
}
