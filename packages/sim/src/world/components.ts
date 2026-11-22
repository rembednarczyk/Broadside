import { type RigidBody } from "../physics/rigid-body";
import { type ShipState } from "../ship/ship-state";
import { type AmmoId, type Faction, type FortClassDef, type FortSite, type ShotState } from "@broadside/core";
import { type CaptainState } from "../ai/captain-state";
import { type PilotState } from "../ai/pilot/state";
import { type ReefingState } from "../systems/reefing-state";

/**
 * The entity: a bag of optional components (ECS with miniplex, ADR-0002). Systems query the
 * components they need (`world.with("body", "ship")`); there is no class hierarchy of entities.
 */
export interface Entity {
  /** Stable id assigned at spawn, used by commands and events. */
  id: number;
  body?: RigidBody;
  ship?: ShipState;
  /** Marks the ship the player commands. */
  player?: true;
  /** Seconds until removal (wreckage, sunk ships). */
  ttl?: number;
  /** A projectile in flight. */
  shot?: Shot;
  /** Sailors in the water waiting to be picked up (Overboard!). */
  castaway?: Castaway;
  /** A fire barrel or a mine drifting astern. */
  floater?: Floater;
  /** A smoke screen drifting downwind. */
  smoke?: SmokeCloud;
  /** An AI captain commanding this ship. */
  captain?: CaptainState;
  /** Standing order to reef in squalls (systems/reefing): the sail plan the captain wants on each mast. */
  reefing?: ReefingState;
  /** The player's route under simple steering (systems/pilot). */
  pilot?: PilotState;
  /** Assisted sailing (systems/assist): the ship makes her top speed on any heading; `astern`: backing the sails. */
  assist?: AssistState;
  /** Riding to an anchor let go here (systems/anchor). */
  anchor?: { x: number; z: number };
  /** A waterspout wandering across the sea. */
  spout?: Spout;
  /** A shore fort. */
  fort?: FortState;
}

export interface AssistState {
  astern: boolean;
  /** The Fun mode: faster, quicker on the helm, quicker to reload (core FUN). */
  fun?: boolean;
}

export interface Shot {
  readonly s: ShotState;
  readonly k: number;
  readonly mass: number;
  readonly ammo: AmmoId;
  readonly owner: number;
  readonly pounder: number;
  age: number;
  bounces: number;
}

export interface Castaway {
  x: number;
  z: number;
  count: number;
  /** Ship the sailors fell from: they rejoin it, or join whoever picks them up. */
  readonly from: number;
  age: number;
}

export interface Floater {
  x: number;
  z: number;
  readonly ammo: "fireBarrel" | "mine";
  readonly owner: number;
  age: number;
}

export interface SmokeCloud {
  x: number;
  z: number;
  age: number;
}

export interface Spout {
  x: number;
  z: number;
  readonly vx: number;
  readonly vz: number;
  readonly radius: number;
  age: number;
  readonly life: number;
}

export interface FortState {
  readonly def: FortClassDef;
  readonly site: FortSite;
  faction: Faction;
  hp: number;
  /** Seconds to reload, per gun; -1 = destroyed. */
  guns: number[];
  mortars: number[];
  garrison: number;
  /** Ship that fired on the fort (it fires back whatever the standing). */
  provokedBy: number | null;
  silenced: boolean;
  /** Seconds before the next gun may fire (the ripple within a division, the pause between divisions). */
  volley: number;
  /** Guns fired so far in the current division. */
  division: number;
  /** The division's error of laying: metres of range, radians of bearing (drawn once per division). */
  lay: { range: number; bearing: number };
  /** Hits taken per wall segment and tower (the renderer breaches the most battered). */
  scars: number[];
  /** Hits the harbour chain can still take (0: none, or broken). */
  chain: number;
  /** The shot furnace is alight (heated shot). */
  furnace: boolean;
  /** Time a ship was last stopped by the chain (one notice per encounter, not per step). */
  barredAt: number;
}
