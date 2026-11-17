import { type HullShape, deckHeight, halfBreadth } from "@broadside/core";

/** Deck height and half-breadth at the deck at a hull-space z (metres from midships, bow +). */
export const deckAt = (h: HullShape, z: number): number => deckHeight(h, z / h.length + 0.5);
export const beamAt = (h: HullShape, z: number): number => halfBreadth(h, z / h.length + 0.5, deckAt(h, z) - 1e-3);
