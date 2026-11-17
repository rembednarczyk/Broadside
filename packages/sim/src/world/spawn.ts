import { type Quat, type ShipClassId, type Vec3, quatFromYaw, vec3 } from "@broadside/core";
import { type SimWorld } from "./world";
import { type Entity } from "./components";
import { createBody } from "../physics/rigid-body";
import { shipModel } from "../ship/ship-model";
import { type FactionId, createShipState } from "../ship/ship-state";
import { type CaptainRole, createCaptain } from "../ai/captain-state";

/** Bigger guns stand off; light ships close in (metres). */
const preferredRange = (id: ShipClassId): number => ({ cutter: 90, gunboat: 220, sloop: 120, schooner: 140, brig: 160, bomb: 380, galleon: 170, frigate: 190, liner: 210 })[id];

export interface SpawnShip {
  readonly classId: ShipClassId;
  readonly faction: FactionId;
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly player?: boolean;
  readonly speed?: number;
  /** Give the ship an AI captain (every ship but the player's, usually). */
  readonly ai?: boolean;
  /** What the AI captain does when no enemy is in sight (default patrol). */
  readonly role?: CaptainRole;
  /** First waypoint of the AI captain (default: where it spawns). */
  readonly wx?: number;
  readonly wz?: number;
}

/** Source of entity ids shared by everything that adds entities (saved with the game). */
export interface IdSource {
  next: number;
}

/** Builds a ship entity from its class (Factory Method, GoF) and adds it to the world. */
export const spawnShip = (world: SimWorld, ids: IdSource, spec: SpawnShip): Entity => {
  const model = shipModel(spec.classId);
  const rot: Quat = quatFromYaw(spec.heading);
  const pos: Vec3 = vec3(spec.x, model.com.y, spec.z);
  const body = createBody(model.mass, model.inertia, pos, rot);
  if (spec.speed) body.vel = vec3(Math.sin(spec.heading) * spec.speed, 0, Math.cos(spec.heading) * spec.speed);
  const e: Entity = { id: ids.next++, body, ship: createShipState(model, spec.faction) };
  if (spec.player) e.player = true;
  if (spec.ai) e.captain = createCaptain(spec.wx ?? spec.x, spec.wz ?? spec.z, preferredRange(spec.classId), spec.role ?? "patrol");
  return world.add(e);
};
