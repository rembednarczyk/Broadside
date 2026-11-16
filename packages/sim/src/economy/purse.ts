import { type EventQueue } from "@broadside/core";

/**
 * The player captain's purse and stores that are not in the ship's hold: gold, plunder waiting to
 * be sold, days of provisions. Part of the simulation state (saved, deterministic).
 */
export interface Purse {
  gold: number;
  /** Value of plunder aboard, sold in port. */
  plunder: number;
  /** Days of food and water for the current crew. */
  provisions: number;
}

export const createPurse = (): Purse => ({ gold: 2000, plunder: 0, provisions: 30 });

export const credit = (p: Purse, events: EventQueue, amount: number, reason: "prize" | "fort" | "trade" | "plunder"): void => {
  if (amount <= 0) return;
  p.gold += amount;
  events.push({ type: "gold", amount, reason });
};
