import { EventQueue, type DomainEvent, type GameCommand, type Quat, type ShipClassId, type Vec3, createRng, quatFromYaw, vec3 } from "@broadside/core";
import { type Environment, createEnvironment, stepEnvironment } from "./environment/environment";
import { type SimContext, type System } from "./systems/context";
import { createSystems } from "./systems/registry";
import { type SimWorld, createWorld, sortedById } from "./world/world";
import { type Entity } from "./world/components";
import { createBody } from "./physics/rigid-body";
import { shipModel } from "./ship/ship-model";
import { type FactionId, createShipState } from "./ship/ship-state";
import { applyCommand } from "./commands/apply";
import { createCaptain } from "./ai/captain-state";

/** Bigger guns stand off; light ships close in (metres). */
const preferredRange = (id: ShipClassId): number => ({ cutter: 120, gunboat: 260, sloop: 160, schooner: 190, brig: 210, bomb: 400, frigate: 260, liner: 280 })[id];

/** Fixed simulation step (60 Hz). The app accumulates frame time and steps in whole steps. */
export const STEP = 1 / 60;

export interface SimulationOptions {
  readonly seed: number;
  readonly windDirection: number;
  readonly windSpeed: number;
}

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
}

/**
 * Facade over the world, the environment and the ordered systems (Facade, GoF). Deterministic:
 * the same options and the same command log give the same state (ADR-0003).
 */
export class Simulation {
  readonly world: SimWorld = createWorld();
  readonly env: Environment;
  readonly events = new EventQueue();
  private readonly systems: readonly System[] = createSystems();
  private readonly ctx: SimContext;
  private nextId = 1;
  private pending: GameCommand[] = [];
  steps = 0;

  constructor(opts: SimulationOptions) {
    this.env = createEnvironment(opts.seed, opts.windDirection, opts.windSpeed);
    this.ctx = { world: this.world, env: this.env, events: this.events, rng: createRng(opts.seed) };
  }

  spawnShip(spec: SpawnShip): Entity {
    const model = shipModel(spec.classId);
    const rot: Quat = quatFromYaw(spec.heading);
    const pos: Vec3 = vec3(spec.x, model.com.y, spec.z);
    const body = createBody(model.mass, model.inertia, pos, rot);
    if (spec.speed) body.vel = vec3(Math.sin(spec.heading) * spec.speed, 0, Math.cos(spec.heading) * spec.speed);
    const e: Entity = { id: this.nextId++, body, ship: createShipState(model, spec.faction) };
    if (spec.player) e.player = true;
    if (spec.ai) e.captain = createCaptain(spec.x, spec.z, preferredRange(spec.classId));
    return this.world.add(e);
  }

  /** Queues a command for the next step. */
  command(cmd: GameCommand): void {
    this.pending.push(cmd);
  }

  step(): void {
    const cmds = this.pending;
    this.pending = [];
    for (const c of cmds) {
      const e = this.byId(c.ship);
      if (e) applyCommand(e, c, this.ctx);
    }
    stepEnvironment(this.env, STEP);
    for (const s of this.systems) s(this.ctx, STEP);
    this.steps++;
  }

  drainEvents(): DomainEvent[] {
    return this.events.drain();
  }

  byId(id: number): Entity | undefined {
    for (const e of this.world.with("ship")) if (e.id === id) return e;
    return undefined;
  }

  ships(): Entity[] {
    return sortedById(this.world.with("ship", "body"));
  }

  player(): Entity | undefined {
    for (const e of this.world.with("player")) return e;
    return undefined;
  }
}
