/**
 * Survey state: the sea cells the player's lookout has had in sight (core/world/survey), in
 * ascending order, and the seconds to the next sweep. Part of the simulation state (saved): the
 * chart's fog of war stays lifted where the ship has been.
 */
export interface Survey {
  seen: number[];
  /** Seconds to the lookout's next sweep. */
  wait: number;
}

export const createSurvey = (): Survey => ({ seen: [], wait: 0 });
