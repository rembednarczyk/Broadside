import { type ShipModel } from "@broadside/sim";
import { beamAt, deckAt } from "./hull-stations";
import { type SideProfile } from "./side-profile";

/**
 * Where the standing rigging is made fast (pure layout, shared by the views that draw it and by
 * the parts list that names it): the stays between the mastheads and to the bowsprit and the rail,
 * and the gangs of shrouds from the channels at the side up to the tops.
 */
export interface StayEnds {
  /** Mast that moves the upper end, and its point in hull space. */
  readonly from: number;
  readonly a: [number, number, number];
  /** Mast that moves the lower end (-1: made fast to the hull or the bowsprit), and its point. */
  readonly to: number;
  readonly b: [number, number, number];
}

/** Fore-and-aft stays from each masthead to the mast ahead (or the bowsprit), and a pair of backstays to the rail. */
export const stayEnds = (tops: readonly { y: number; z: number }[], bow: { y: number; z: number }, hull: { beam: number; freeboard: number }): StayEnds[] => {
  const ends: StayEnds[] = [];
  const order = tops.map((t, i) => ({ t, i })).sort((p, q) => q.t.z - p.t.z);
  order.forEach(({ t, i }, k) => {
    const prev = order[k - 1];
    ends.push(prev ? { from: i, a: [0, t.y * 0.97, t.z], to: prev.i, b: [0, prev.t.y * 0.6, prev.t.z] } : { from: i, a: [0, t.y * 0.97, t.z], to: -1, b: [0, bow.y, bow.z] });
    for (const sx of [-1, 1]) ends.push({ from: i, a: [0, t.y, t.z], to: -1, b: [sx * hull.beam * 0.48, hull.freeboard + 1, t.z - 5] });
  });
  return ends;
};

export interface Shroud {
  readonly foot: readonly [number, number, number];
  readonly head: readonly [number, number, number];
}

export interface ShroudLadder {
  readonly mast: number;
  readonly side: -1 | 1;
  readonly shrouds: readonly Shroud[];
  /** Ratlines between the shrouds. */
  readonly rungs: number;
}

/**
 * Four shrouds a side to each mast, from a channel at the side to under the top. On a modelled
 * hull (`side`) the feet stand at the model's side just under its rail, else at the generated hull's.
 */
export const shroudLadders = (model: ShipModel, side: SideProfile | null = null): ShroudLadder[] => {
  const h = model.def.hull;
  const ladders: ShroudLadder[] = [];
  model.def.masts.forEach((m, mast) => {
    const topY = h.freeboard + m.height * 0.58;
    for (const s of [-1, 1] as const) {
      const footX = side ? side.halfAt(m.z) + 0.3 : beamAt(h, m.z) + 0.35;
      const footY = side ? side.topAt(m.z) - 0.25 : deckAt(h, m.z) + 0.9;
      const shrouds = [-1.6, -0.55, 0.55, 1.6].map((dz): Shroud => ({ foot: [s * footX, footY, m.z + dz], head: [s * 0.45, topY, m.z + dz * 0.25] }));
      ladders.push({ mast, side: s, shrouds, rungs: Math.floor((topY - deckAt(h, m.z) - 1) / 0.55) });
    }
  });
  return ladders;
};
