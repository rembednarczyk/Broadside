import { type RigidBody } from "../physics/rigid-body";
import { type ShipState } from "../ship/ship-state";

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
}
