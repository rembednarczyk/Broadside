import { type System } from "./context";
import { helmSystem } from "./helm";
import { sailSystem } from "./sails";
import { hydroSystem } from "./hydro";
import { integrateSystem } from "./integrate";

/**
 * The only place that orders systems (ADR-0002): an explicit array, never the iteration order of
 * a map. Forces first, then one integration, then rules that read the new state.
 */
export const createSystems = (): readonly System[] => [helmSystem, sailSystem, hydroSystem, integrateSystem];
