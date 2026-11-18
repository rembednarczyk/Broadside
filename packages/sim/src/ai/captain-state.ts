/**
 * AI captain state (State pattern, "Game Programming Patterns" ch. 7, as a finite state machine
 * whose states are plain data so the simulation stays serialisable and deterministic).
 */
export type CaptainMode = "patrol" | "engage" | "flee" | "struck";
/**
 * Standing orders: patrol (wander and fight enemies), trade (sail port to port, run from
 * enemies), hunt (seek out the player's ship from afar).
 */
export type CaptainRole = "patrol" | "trade" | "hunt";

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
  role: CaptainRole;
  /** Destination port index while trading (-1: none). */
  dest: number;
  /** Ship this one keeps station on in a convoy (-1: sails alone). */
  leader: number;
  /** The way to the waypoint round the islands (ai/waypoints), and the waypoint it was planned for. */
  way?: { x: number; z: number }[];
  wayFor?: string;
}

export const createCaptain = (wx: number, wz: number, range: number, role: CaptainRole = "patrol"): CaptainState => ({ mode: "patrol", target: null, think: 0, wx, wz, side: "starboard", range, role, dest: -1, leader: -1 });
