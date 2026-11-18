import { type AmmoId } from "../data/ammo";
import { type MountKind, type ShipClassId } from "../data/ship-classes";
import { type UpgradeId } from "../data/upgrades";

/** Port services (shipyard: buy a new ship, trading the old one in). */
export type TradeService = "ammo" | "crew" | "repair" | "provisions" | "sellPlunder" | "buyShip" | "upgrade" | "contract";

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
  /**
   * Sail to these points in turn (simple steering): the crew steers and makes sail (sim pilot).
   * `hold`: after the last point keep its direction (a course drawn on the water); otherwise
   * take in sail there (a destination). An empty route cancels it.
   */
  | { readonly type: "navigate"; readonly ship: EntityId; readonly route: readonly { readonly x: number; readonly z: number }[]; readonly hold: boolean }
  /** Sail plan of one mast, or of every mast. */
  | { readonly type: "sails"; readonly ship: EntityId; readonly mast: number | "all"; readonly level: SailLevel }
  /**
   * Fire a battery at a range. `bearing` (world heading of the aim point) trains the guns towards
   * it within their port limits; without it they fire square to their mounting. `aimHeight` is
   * the height of the aim point above the sea (a fort's walls), 0 for a hull at the waterline.
   */
  | { readonly type: "fire"; readonly ship: EntityId; readonly mount: MountKind; readonly side?: Side; readonly range: number; readonly bearing?: number; readonly aimHeight?: number }
  | { readonly type: "loadAmmo"; readonly ship: EntityId; readonly mount: MountKind; readonly ammo: AmmoId }
  | { readonly type: "drop"; readonly ship: EntityId; readonly ammo: "fireBarrel" | "mine" | "smoke" }
  | { readonly type: "brace"; readonly ship: EntityId }
  | { readonly type: "oars"; readonly ship: EntityId; readonly on: boolean }
  | { readonly type: "board"; readonly ship: EntityId; readonly target: EntityId }
  /** Land a storming party on a silenced fort within reach. */
  | { readonly type: "assault"; readonly ship: EntityId; readonly fort: EntityId }
  /** Port services while alongside (port: index into the world's ports). */
  | { readonly type: "trade"; readonly ship: EntityId; readonly port: number; readonly service: TradeService; readonly ammo?: AmmoId; readonly qty: number; readonly classId?: ShipClassId; readonly upgrade?: UpgradeId };

export type CommandType = GameCommand["type"];
