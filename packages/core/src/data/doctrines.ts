import { type Faction } from "./factions";

/**
 * Fighting doctrines of the age of sail as data (Type Object; behaviour in sim/ai/tactics). Sources
 * are the standard naval histories (e.g. Lavery, "Nelson's Navy"; Tunstall, "Naval Warfare in the
 * Age of Sail"): the British fought close and fired into the hull on the down-roll; the French
 * kept the lee gauge, fired high on the up-roll at masts and rigging to cripple and break off; the
 * Spanish relied on musketry and boarding; pirates closed fast to board, swept the decks with grape.
 * Every navy prized the weather gauge and the chance to rake an enemy through stern or bow.
 */
export interface Doctrine {
  /** Preferred range as a share of the class's range. */
  readonly rangeFactor: number;
  /** Fire high, into masts and rigging (with chain shot), rather than into the hull. */
  readonly rigging: boolean;
  /** Work to windward of the enemy before closing. */
  readonly windward: boolean;
  /** Manoeuvre to rake through stern or bow when the enemy offers it. */
  readonly rake: boolean;
  /** Crew advantage needed to board (lower boards sooner). */
  readonly boardRatio: number;
}

export const DOCTRINES: Readonly<Record<Faction, Doctrine>> = {
  crown: { rangeFactor: 0.75, rigging: false, windward: true, rake: true, boardRatio: 1.6 },
  republic: { rangeFactor: 1.0, rigging: true, windward: false, rake: true, boardRatio: 1.8 },
  empire: { rangeFactor: 0.9, rigging: false, windward: true, rake: false, boardRatio: 1.25 },
  pirates: { rangeFactor: 0.7, rigging: false, windward: false, rake: true, boardRatio: 1.1 },
  player: { rangeFactor: 1, rigging: false, windward: true, rake: true, boardRatio: 1.6 },
};
