import { type ShipClassId } from "./ship-classes";
import { type Faction } from "./factions";

/**
 * Who sails the archipelago (Type Object, "Game Programming Patterns" ch. 13): each kind of
 * traffic names its standing orders, weight in the mix, flags and hulls. The population director
 * in `sim` draws from this table; behaviour lives in the AI captain.
 */
export type TrafficRole = "patrol" | "trade" | "hunt";

export interface TrafficKind {
  readonly id: string;
  readonly role: TrafficRole;
  readonly weight: number;
  readonly factions: readonly Faction[];
  readonly classes: readonly ShipClassId[];
  /** Spawned even while the player is fighting (harmless traffic keeps the sea alive). */
  readonly peaceful: boolean;
  /** Convoys: extra merchantmen and warships keeping station on the first ship. */
  readonly convoy?: { readonly merchants: number; readonly escorts: readonly ShipClassId[] };
}

export const TRAFFIC: readonly TrafficKind[] = [
  { id: "convoy", role: "trade", weight: 0.1, factions: ["crown", "republic", "empire"], classes: ["brig", "galleon"], peaceful: false, convoy: { merchants: 1, escorts: ["frigate", "brig"] } },
  { id: "merchant", role: "trade", weight: 0.32, factions: ["crown", "republic", "empire"], classes: ["sloop", "schooner", "brig", "galleon"], peaceful: true },
  { id: "patrol", role: "patrol", weight: 0.25, factions: ["crown", "republic", "empire"], classes: ["brig", "frigate", "frigate", "liner", "gunboat"], peaceful: false },
  { id: "pirate", role: "patrol", weight: 0.25, factions: ["pirates"], classes: ["cutter", "sloop", "schooner", "brig", "gunboat"], peaceful: false },
  { id: "hunter", role: "hunt", weight: 0.1, factions: ["pirates"], classes: ["schooner", "brig", "frigate"], peaceful: false },
];

/** Picks a traffic kind by weight from a uniform number 0..1 (roulette-wheel selection). */
export const pickTraffic = (u: number, kinds: readonly TrafficKind[] = TRAFFIC): TrafficKind => {
  const total = kinds.reduce((a, k) => a + k.weight, 0);
  let acc = 0;
  for (const k of kinds) {
    acc += k.weight / total;
    if (u < acc) return k;
  }
  return kinds[kinds.length - 1]!;
};
