import { type EventQueue, type Rng } from "@broadside/core";
import { type Environment } from "../environment/environment";
import { type SimWorld } from "../world/world";

/** What every system receives (Update Method pattern, "Game Programming Patterns" ch. 10). */
export interface SimContext {
  readonly world: SimWorld;
  readonly env: Environment;
  readonly events: EventQueue;
  readonly rng: Rng;
}

export type System = (ctx: SimContext, dt: number) => void;
