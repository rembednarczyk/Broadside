import { type RigidBody } from "../physics/rigid-body";
import { type ShipState } from "../ship/ship-state";
import { type AmmoId, type ShotState } from "@broadside/core";
import { type CaptainState } from "../ai/captain-state";

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
  /** An AI captain commanding this ship. */
  captain?: CaptainState;
  /** A waterspout wandering across the sea. */
  spout?: Spout;
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

export interface Spout {
  x: number;
  z: number;
  readonly vx: number;
  readonly vz: number;
  readonly radius: number;
  age: number;
  readonly life: number;
}
