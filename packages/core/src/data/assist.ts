/**
 * Assisted sailing, the third steering mode (decyzje 18.11; Type Object data for sim/systems/assist):
 * the ship makes her own top speed on any heading, the wind only easing her in light airs, and
 * answers the helm like the ships of an action game. The weather still acts on her: the sea moves
 * the hull, the wind heels her and loads the masts, a squall makes the crew reef.
 */
export const ASSIST = {
  /**
   * Top speed under full sail as a Froude number of her waterline: the hull speed of a
   * displacement ship, v = Fr * sqrt(g L) (naval architecture; real hulls run out of speed near
   * 0.4). 0.35 gives a galleon about 12.5 kn, the game's fresh-breeze speed (sails.SAIL_GAIN).
   */
  froude: 0.35,
  /** Speed going astern with the sails backed (m/s). */
  astern: 1.6,
  /** How fast the speed answers (1/s) and the most acceleration the drive gives (m/s^2). */
  gain: 1.5,
  maxAccel: 0.8,
  /** Turning circle radius in ship lengths with the helm hard over (tactical diameter about 2.4 lengths). */
  turnRadius: 1.2,
  /** Least speed the turn is reckoned for (m/s): she comes round when slow too. */
  turnSpeed: 2.5,
  /** How fast the rate of turn answers (1/s). */
  yawGain: 2,
  /** Share of the sails' side force kept: the heel and a little leeway, so the wind is felt. */
  sideForce: 0.4,
  /** In light airs she goes slower: this share of her speed in a calm, all of it from `fullWind` (m/s). */
  calm: 0.55,
  fullWind: 6,
} as const;

/** Speed the drive makes for: the hull speed times the share of canvas set (1 full sail, 1.25 with studding sails) and the wind's share. */
export const assistSpeed = (length: number, set: number, wind: number): number => {
  const air = ASSIST.calm + (1 - ASSIST.calm) * Math.min(1, Math.max(0, wind / ASSIST.fullWind));
  return ASSIST.froude * Math.sqrt(9.81 * length) * set * air;
};
