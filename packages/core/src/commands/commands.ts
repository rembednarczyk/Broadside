import { type AmmoId } from "../data/ammo";
import { type MountKind } from "../data/ship-classes";

/**
 * Commands (Command pattern, GoF; "Game Programming Patterns" ch. 2): the only way a player or an
 * AI captain changes the simulation. A step applies the queued commands in arrival order, so a
 * seed plus a command log replays a voyage exactly (ADR-0003).
 */
export type EntityId = number;
export type Side = "port" | "starboard";

/** 0 furled, 1 reefed, 2 battle sails, 3 full sail, 4 full with studding sails. */
export type SailLevel = 0 | 1 | 2 | 3 | 4;
export const SAIL_LEVELS: readonly SailLevel[] = [0, 1, 2, 3, 4];

export type GameCommand =
  /** Rudder from -1 (hard to port) to 1 (hard to starboard). */
  | { readonly type: "helm"; readonly ship: EntityId; readonly rudder: number }
  /** The helmsman steers to and holds a heading (null hands the wheel back to "helm"). */
  | { readonly type: "course"; readonly ship: EntityId; readonly heading: number | null }
  /** Sail plan of one mast, or of every mast. */
  | { readonly type: "sails"; readonly ship: EntityId; readonly mast: number | "all"; readonly level: SailLevel }
  /**
   * Fire a battery at a range. `bearing` (world heading of the aim point) trains the guns towards
   * it within their port limits; without it they fire square to their mounting.
   */
  | { readonly type: "fire"; readonly ship: EntityId; readonly mount: MountKind; readonly side?: Side; readonly range: number; readonly bearing?: number }
  | { readonly type: "loadAmmo"; readonly ship: EntityId; readonly mount: MountKind; readonly ammo: AmmoId }
  | { readonly type: "drop"; readonly ship: EntityId; readonly ammo: "fireBarrel" | "mine" }
  | { readonly type: "brace"; readonly ship: EntityId }
  | { readonly type: "oars"; readonly ship: EntityId; readonly on: boolean }
  | { readonly type: "board"; readonly ship: EntityId; readonly target: EntityId };

export type CommandType = GameCommand["type"];
