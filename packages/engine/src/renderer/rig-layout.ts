import { type ShipModel } from "@broadside/sim";
import { beamAt, deckAt } from "./hull-stations";
import { type RigPlan } from "./rig-plan";
import { CASTLE_WALL, sternCastle } from "./castle-layout";
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
export const stayEnds = (tops: readonly { y: number; z: number }[], bow: { y: number; z: number }, hull: { beam: number; freeboard: number }, side: SideProfile | null = null): StayEnds[] => {
  const ends: StayEnds[] = [];
  const order = tops.map((t, i) => ({ t, i })).sort((p, q) => q.t.z - p.t.z);
  order.forEach(({ t, i }, k) => {
    const prev = order[k - 1];
    ends.push(prev ? { from: i, a: [0, t.y * 0.97, t.z], to: prev.i, b: [0, prev.t.y * 0.6, prev.t.z] } : { from: i, a: [0, t.y * 0.97, t.z], to: -1, b: [0, bow.y, bow.z] });
    // The backstays come down to the rail abaft the mast: on a modelled hull, to the model's own side.
    const z = t.z - 5;
    for (const sx of [-1, 1]) ends.push({ from: i, a: [0, t.y, t.z], to: -1, b: side ? [sx * (side.halfAt(z) + 0.12), side.topAt(z) - 0.2, z] : [sx * hull.beam * 0.48, hull.freeboard + 1, z] });
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
  // The sterncastle a modelled hull carries: no shroud may pass through it.
  const castle = side ? sternCastle(side) : null;
  const breakZ = castle ? castle.ring[castle.ring.length - 1]!.z : -Infinity;
  model.def.masts.forEach((m, mast) => {
    const topY = h.freeboard + m.height * 0.58;
    const spread = [-1.6, -0.55, 0.55, 1.6];
    // A mast before the break of the castle has its gang shifted forward clear of it; a mast that
    // stands in the castle has its channels on the castle's side at the height of its deck.
    const inCastle = m.z < breakZ - 0.5;
    const shift = inCastle ? 0 : Math.max(0, breakZ + 0.35 - (m.z + spread[0]!));
    for (const s of [-1, 1] as const) {
      const shrouds = spread.map((dz): Shroud => {
        const z = m.z + dz + shift;
        const footX = side ? side.halfAt(z) + 0.3 : beamAt(h, z) + 0.35;
        const footY = side ? Math.max(side.topAt(z) - 0.25, inCastle && castle ? castle.base + CASTLE_WALL + 0.06 : -Infinity) : deckAt(h, z) + 0.9;
        return { foot: [s * footX, footY, z], head: [s * 0.45, topY, m.z + dz * 0.25] };
      });
      ladders.push({ mast, side: s, shrouds, rungs: Math.floor((topY - deckAt(h, m.z) - 1) / 0.55) });
    }
  });
  return ladders;
};

/** A corner of a sail on its grid: the foot (clews) or the head (yardarms), at the first or last column. */
export interface SailCorner {
  readonly plan: number;
  readonly row: "foot" | "head";
  readonly col: "first" | "last";
}

/**
 * A line of the running rigging: from a corner of a sail to another sail's corner, or to a point
 * of the hull (for which `aside` says how far off the centre line it is made fast, on the side
 * the corner is on at the moment: yards are braced round, so the side is not fixed).
 */
export interface RunningLine {
  readonly kind: "sheet" | "brace" | "lift" | "clewline";
  readonly from: SailCorner;
  readonly to: SailCorner | { readonly aside: number; readonly y: number; readonly z: number };
}

/**
 * Sheets and braces as a square rigger leads them: the clews of a course are sheeted to the ship's
 * side abaft the sail, those of a topsail or topgallant to the yardarms below; every yard has a
 * brace from each arm, led aft to the next mast (from the aftermost mast, to the quarters). A gaff
 * sail has its sheet from the boom end to the stern, a jib from its clew to the deck by the mast.
 * Each square yard hangs in lifts, from its arms to the mast above (the cap of the mast it is on,
 * by the foot of the yard over it, or the masthead), and each clew has a clewline up the leech to
 * the yardarm (the line that hauls the clew up when the sail is taken in; at sea it runs close
 * along the sail's edge). A gaff has its peak halyard and a boom its topping lift to the masthead.
 * (Lever, "The Young Sea Officer's Sheet Anchor", 1808: lifts, clewlines, peak halyards.)
 */
export const runningRigging = (plan: RigPlan, hull: { length: number; beam: number; freeboard: number }): RunningLine[] => {
  const lines: RunningLine[] = [];
  const rail = hull.freeboard + 0.9;
  const groups = new Map<string, number[]>();
  plan.sails.forEach((s, i) => {
    if (s.shape === "square") groups.set(`${s.mast}:${s.nodeZ}`, [...(groups.get(`${s.mast}:${s.nodeZ}`) ?? []), i]);
  });
  const mastZs = plan.mastTops.map((t) => t.z);
  for (const tiers of groups.values()) {
    tiers.sort((p, q) => plan.sails[p]!.foot - plan.sails[q]!.foot);
    tiers.forEach((i, j) => {
      const s = plan.sails[i]!;
      const yardY = s.foot + s.height;
      // The mast next abaft this sail takes its braces.
      const abaft = mastZs.filter((z) => z < s.nodeZ - 1).sort((p, q) => q - p)[0];
      for (const col of ["first", "last"] as const) {
        const below = tiers[j - 1];
        lines.push({ kind: "sheet", from: { plan: i, row: "foot", col }, to: below === undefined ? { aside: hull.beam * 0.44, y: rail, z: s.nodeZ - Math.min(3, hull.length * 0.08) } : { plan: below, row: "head", col } });
        lines.push({ kind: "brace", from: { plan: i, row: "head", col }, to: abaft === undefined ? { aside: hull.beam * 0.42, y: rail, z: -hull.length * 0.44 } : { aside: 0, y: yardY * 0.86, z: abaft } });
        const above = tiers[j + 1];
        const capY = above === undefined ? plan.mastTops[s.mast]!.y : plan.sails[above]!.foot + 0.3;
        lines.push({ kind: "lift", from: { plan: i, row: "head", col }, to: { aside: 0.3, y: Math.max(capY, yardY + 1), z: s.nodeZ } });
        lines.push({ kind: "clewline", from: { plan: i, row: "foot", col }, to: { plan: i, row: "head", col } });
      }
    });
  }
  plan.sails.forEach((s, i) => {
    if (s.shape === "gaff") {
      lines.push({ kind: "sheet", from: { plan: i, row: "foot", col: "last" }, to: { aside: 0, y: rail, z: Math.min(s.nodeZ - s.width * 0.8, -hull.length * 0.4) } });
      const head = { aside: 0, y: plan.mastTops[s.mast]!.y, z: plan.mastTops[s.mast]!.z };
      lines.push({ kind: "lift", from: { plan: i, row: "head", col: "last" }, to: head }, { kind: "lift", from: { plan: i, row: "foot", col: "last" }, to: head });
    }
    if (s.shape === "jib") lines.push({ kind: "sheet", from: { plan: i, row: "foot", col: "last" }, to: { aside: hull.beam * 0.3, y: rail, z: mastZs[s.mast]! - 1 } });
  });
  return lines;
};
