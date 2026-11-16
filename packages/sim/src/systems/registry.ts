import { type System } from "./context";
import { helmSystem } from "./helm";
import { sailSystem } from "./sails";
import { hydroSystem } from "./hydro";
import { integrateSystem } from "./integrate";
import { gunsSystem } from "./guns";
import { shotsSystem } from "./shots";
import { floatersSystem } from "./floaters";
import { damageControlSystem } from "./damage-control";
import { castawaySystem } from "./castaways";
import { cleanupSystem } from "./cleanup";
import { captainSystem } from "./captain";
import { weatherSystem } from "./weather";
import { spoutSystem } from "./spouts";
import { groundingSystem } from "./grounding";
import { fortSystem } from "./forts";
import { provisionsSystem } from "./provisions";
import { collisionSystem } from "./collisions";

/**
 * The only place that orders systems (ADR-0002): an explicit array, never the iteration order of
 * a map. Decisions, then forces and one integration, then the rules that read the new state.
 */
export const createSystems = (): readonly System[] => [
  weatherSystem,
  captainSystem,
  helmSystem,
  sailSystem,
  hydroSystem,
  groundingSystem,
  integrateSystem,
  collisionSystem,
  gunsSystem,
  fortSystem,
  shotsSystem,
  floatersSystem,
  spoutSystem,
  damageControlSystem,
  castawaySystem,
  provisionsSystem,
  cleanupSystem,
];
