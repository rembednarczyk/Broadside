import { portSites, type PortSite, type FortSite, type Archipelago, type WeatherKind, EventQueue, type DomainEvent, type GameCommand, createRng } from "@broadside/core";
import { type Environment, createEnvironment, stepEnvironment } from "./environment/environment";
import { type SimContext, type System } from "./systems/context";
import { createSystems } from "./systems/registry";
import { type SimWorld, createWorld, sortedById } from "./world/world";
import { type Entity } from "./world/components";
import { applyCommand } from "./commands/apply";
import { type IdSource, type SpawnShip, spawnShip } from "./world/spawn";
import { createFort } from "./combat/forts";
import { type Purse, createPurse } from "./economy/purse";

/** Fixed simulation step (60 Hz). The app accumulates frame time and steps in whole steps. */
export const STEP = 1 / 60;

export interface SimulationOptions {
  readonly seed: number;
  readonly windDirection: number;
  readonly windSpeed: number;
  /** Starting weather; omitted, the wind stays as given (tests, set pieces). */
  readonly weather?: WeatherKind;
  /** Islands; omitted, open sea. */
  readonly archipelago?: Archipelago;
  /** Let the population director add and remove traffic around the player (the sandbox). */
  readonly traffic?: boolean;
}

export type { SpawnShip } from "./world/spawn";

/**
 * Facade over the world, the environment and the ordered systems (Facade, GoF). Deterministic:
 * the same options and the same command log give the same state (ADR-0003).
 */
export class Simulation {
  readonly world: SimWorld = createWorld();
  readonly env: Environment;
  readonly events = new EventQueue();
  private readonly systems: readonly System[] = createSystems();
  private ctx: SimContext;
  private readonly ids: IdSource = { next: 1 };
  readonly purse: Purse = createPurse();
  readonly ports: readonly PortSite[];
  private pending: GameCommand[] = [];
  steps = 0;

  constructor(opts: SimulationOptions) {
    this.env = createEnvironment(opts.seed, opts.windDirection, opts.windSpeed, opts.weather, opts.archipelago ?? null);
    this.ports = opts.archipelago ? portSites(opts.archipelago) : [];
    this.ctx = { world: this.world, env: this.env, events: this.events, rng: createRng(opts.seed), purse: this.purse, ports: this.ports, ids: this.ids, traffic: opts.traffic ?? false };
  }

  /** Next entity id (for save and restore). */
  get nextId(): number {
    return this.ids.next;
  }

  set nextId(v: number) {
    this.ids.next = v;
  }

  /** Generator state of the simulation's random stream (for saves). */
  rngState(): number {
    return this.ctx.rng.state();
  }

  /** Continues the random stream from a saved state (createRng with a state resumes it exactly). */
  restoreRng(state: number): void {
    this.ctx = { ...this.ctx, rng: createRng(state) };
  }

  spawnShip(spec: SpawnShip): Entity {
    return spawnShip(this.world, this.ids, spec);
  }

  /** Builds a fort at a site (shore works fire on hostile ships in range). */
  spawnFort(site: FortSite): Entity {
    return this.world.add({ id: this.ids.next++, fort: createFort(site) });
  }

  forts(): Entity[] {
    return sortedById(this.world.with("fort"));
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
