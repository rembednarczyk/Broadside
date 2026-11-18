import { type SailLevel } from "@broadside/core";

/** The standing order to reef (plain data, saved with the game): what the captain wants set, and how long each mast has had an easy load. */
export interface ReefingState {
  wanted: SailLevel[];
  easy: number[];
  think: number;
}
