/** The player's route under simple steering (ai/pilot, systems/pilot); kept apart, as CaptainState is, so components need no AI code. */
export interface PilotState {
  /** Points still to reach, the next first. */
  route: { x: number; z: number }[];
  /** After the last point: keep its direction (a drawn course) or take in sail (a destination). */
  hold: boolean;
  /** Direction of the leg last sailed (for `hold`), and where that leg began. */
  heading: number;
  from: { x: number; z: number };
  /** Seconds to the next look at the route. */
  think: number;
  /** Leeway the ship makes (radians, smoothed): the angle her track falls off her heading. */
  leeway?: number;
}
