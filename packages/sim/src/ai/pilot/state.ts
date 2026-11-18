/**
 * What the crew has been told to do under simple steering (ai/pilot): one order at a time, kept
 * on the ship (component `pilot`, saved with the game). Plain data, no AI code, so the
 * components and the save need nothing else (as CaptainState).
 */
export type P = { x: number; z: number };

export type PilotOrder =
  /** Sail through the points; `hold`: then keep the last leg's direction (a drawn course), else take in sail (a destination). */
  | { kind: "route"; route: P[]; hold: boolean; heading: number; from: P }
  /** Run down a ship and board her once alongside. */
  | { kind: "board"; target: number }
  /** Keep station astern of a ship (escort, follow). */
  | { kind: "follow"; target: number }
  /** Close a fort to storming distance; storm it if silenced, else heave to there (bombard). */
  | { kind: "assault"; fort: number };

export interface PilotState {
  order: PilotOrder;
  /** Seconds to the next look at the order. */
  think: number;
  /** Leeway the ship makes (radians, smoothed): the angle her track falls off her heading. */
  leeway?: number;
}

/** A save written with the first, route-only pilot (route, hold, heading, from on the state itself). */
export const upgradePilot = (p: PilotState | (Omit<PilotState, "order"> & { route: P[]; hold: boolean; heading: number; from: P })): PilotState =>
  "order" in p ? p : { order: { kind: "route", route: p.route, hold: p.hold, heading: p.heading, from: p.from }, think: p.think, ...(p.leeway !== undefined ? { leeway: p.leeway } : {}) };
