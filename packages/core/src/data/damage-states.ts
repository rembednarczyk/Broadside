/**
 * The condition of a ship as the player reads it (M11; the health states of an action game's naval
 * combat, Black Flag's segmented health bar and its "disabled" ship ready to board): one name for
 * the state of the hull, the masts and the rigging together. Type Object data with one pure rule;
 * the simulation keeps the measures (sections, masts, rigging), this only names their state.
 */
export type DamageState = "sound" | "damaged" | "battered" | "disabled" | "struck" | "sinking";

export const DAMAGE_STATES = {
  /** Below this share of hull, or of canvas or rigging, a ship is damaged. */
  damaged: 0.75,
  /** Below this share of hull she is battered (the AI captain thinks of flight from 0.3). */
  battered: 0.4,
  /** With no mast standing, or the rigging below this, she cannot make sail: disabled (cannot flee, ready to be boarded). */
  disabledRigging: 0.2,
  /** Segments of the health bar (each a quarter of the hull). */
  segments: 4,
} as const;

/**
 * A disabled ship (no mast standing or her rigging shot away) cannot run: her captain strikes when
 * an enemy closes within `strikeRange` and his own men are fewer than `outnumbered` times hers; a
 * disabled crew defends the deck worse (`boardingDefence` against 1.15 for a ship in fighting trim).
 */
export const DISABLED = {
  strikeRange: 300,
  outnumbered: 1.3,
  boardingDefence: 0.85,
} as const;

/** The measures of a ship's condition, each a share of the whole (0..1). */
export interface ShipCondition {
  readonly hull: number;
  readonly mastsStanding: number;
  readonly rigging: number;
  readonly canvas: number;
  readonly struck: boolean;
  readonly sinking: boolean;
}

export const damageState = (c: ShipCondition): DamageState => {
  const d = DAMAGE_STATES;
  if (c.sinking) return "sinking";
  if (c.struck) return "struck";
  if (c.mastsStanding <= 0 || c.rigging < d.disabledRigging) return "disabled";
  if (c.hull < d.battered) return "battered";
  if (c.hull < d.damaged || c.canvas < d.damaged || c.rigging < d.damaged) return "damaged";
  return "sound";
};

/**
 * A mast gone by the board stays fast to the ship by its rigging and drags alongside (the period's
 * wreckage of spars "hanging over the side", which crews cut away with axes): it brakes her and
 * turns her towards that side until it is cut free, `cut` seconds with a full crew (longer with
 * fewer hands). The drag is a quadratic drag of the wreck's wetted area, `area` square metres per
 * metre of mast, at the waterline abeam.
 */
export const WRECKAGE = {
  cut: 40,
  area: 0.35,
  drag: 1.0,
} as const;
