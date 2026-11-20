import { type EventQueue, type PortSite, type Relations, type Rng } from "@broadside/core";
import { type Purse } from "../economy/purse";
import { type Environment } from "../environment/environment";
import { type SimWorld } from "../world/world";
import { type IdSource } from "../world/spawn";
import { type Jobs } from "../economy/jobs";
import { type Salvage } from "../economy/salvage-state";
import { type Survey } from "../economy/survey-state";

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
  /** Entity ids, for systems that add entities (the population director). */
  readonly ids: IdSource;
  /** Population director on (the sandbox) or off (tests, set pieces). */
  readonly traffic: boolean;
  /** The player's standing with each faction. */
  readonly relations: Relations;
  /** The player's contract, if any. */
  readonly jobs: Jobs;
  /** The wrecks already salvaged and the one being worked. */
  readonly salvage: Salvage;
  /** The sea cells the player's lookout has had in sight (the chart's fog of war). */
  readonly survey: Survey;
}

export type System = (ctx: SimContext, dt: number) => void;
