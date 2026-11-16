import { type EventQueue, type PortSite, type Rng } from "@broadside/core";
import { type Purse } from "../economy/purse";
import { type Environment } from "../environment/environment";
import { type SimWorld } from "../world/world";

/** What every system receives (Update Method pattern, "Game Programming Patterns" ch. 10). */
export interface SimContext {
  readonly world: SimWorld;
  readonly env: Environment;
  readonly events: EventQueue;
  readonly rng: Rng;
  /** The player captain's purse (null in tests without a player economy). */
  readonly purse: Purse | null;
  /** Ports of the world (empty on the open sea). */
  readonly ports: readonly PortSite[];
}

export type System = (ctx: SimContext, dt: number) => void;
