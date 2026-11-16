/**
 * AI captain state (State pattern, "Game Programming Patterns" ch. 7, as a finite state machine
 * whose states are plain data so the simulation stays serialisable and deterministic).
 */
export type CaptainMode = "patrol" | "engage" | "flee" | "struck";

export interface CaptainState {
  mode: CaptainMode;
  target: number | null;
  /** Seconds until the captain reconsiders (decisions are not taken every step). */
  think: number;
  /** Patrol waypoint. */
  wx: number;
  wz: number;
  /** Side the captain prefers to fight with, until it changes its mind. */
  side: "port" | "starboard";
  /** Preferred fighting range in metres (from the class: bigger guns stand off). */
  range: number;
}

export const createCaptain = (wx: number, wz: number, range: number): CaptainState => ({ mode: "patrol", target: null, think: 0, wx, wz, side: "starboard", range });
