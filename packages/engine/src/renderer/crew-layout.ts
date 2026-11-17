import { type ShipModel } from "@broadside/sim";
import { type CastleLayout, WHEEL_ABAFT, WHEEL_REACH } from "./castle-layout";
import { type GunPlace } from "./gun-layout";
import { type SideProfile } from "./side-profile";

/**
 * Where the crew stand on a modelled hull and what each man is there for (pure layout, tested). The
 * stations of a ship's company at sea: the helmsman at the wheel on the quarterdeck and the officer of the watch beside him, a lookout in
 * the maintop, men along the taffrail (the reference's stern shots show six to eight there,
 * ref_090), hands at the foot of each mast for the halyards and clewlines, hands at the braces by
 * the sides, the crews of the upper deck's guns and the rest about the waist. Stations are listed in the order
 * they are manned, so as the crew falls the waist empties first and the wheel last. Positions are
 * a man's feet in hull space; a fixed integer sequence spreads them, no random source.
 */
export type CrewRole = "wheel" | "officer" | "lookout" | "gun" | "halyard" | "brace" | "rail" | "waist";

export interface CrewSpot {
  readonly at: readonly [number, number, number];
  /** Rotation about the vertical (radians): which way the man faces (0: forward). */
  readonly yaw: number;
  readonly role: CrewRole;
  /** The mast or the gun the station belongs to (-1: none). */
  readonly of: number;
}

/** How many figures a crew is drawn with: one for every six hands, at most forty. */
export const crewFigures = (crew: number): number => Math.min(40, Math.round(crew / 6));

const frac = (v: number): number => v - Math.floor(v);
const spread = (i: number, salt: number): number => frac(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453);

export interface CrewDecks {
  readonly side: SideProfile;
  readonly castle: CastleLayout | null;
  readonly guns: readonly GunPlace[];
  /** The fighting tops (rig plan): height and station of each. */
  readonly tops: readonly { readonly y: number; readonly z: number }[];
}

/** Height of the deck a man stands on at a station: the castle's deck aft of its break, else the waist. */
const deckY = (d: CrewDecks, z: number): number => (d.castle && z < d.castle.ring[d.castle.ring.length - 1]!.z ? d.castle.top : d.castle ? d.castle.waist : d.side.topAt(z) - 0.95);

export const modelCrewSpots = (model: ShipModel, d: CrewDecks): CrewSpot[] => {
  const total = crewFigures(model.def.crew);
  const spots: CrewSpot[] = [];
  const free = (x: number, z: number, gap = 0.8): boolean => !spots.some((s) => Math.hypot(s.at[0] - x, s.at[2] - z) < gap);
  const push = (s: CrewSpot): void => {
    if (spots.length < total) spots.push(s);
  };
  const masts = model.def.masts.map((m) => m.z);
  const mainIndex = model.def.masts.reduce((best, m, i, all) => (m.height > all[best]!.height ? i : best), 0);
  const main = masts[mainIndex]!;
  // The helmsman: on the castle's deck just abaft its break, or in the waist abaft the mizzen.
  const wheelZ = d.castle ? d.castle.ring[d.castle.ring.length - 1]!.z - WHEEL_ABAFT - WHEEL_REACH : Math.min(...masts) - 3;
  push({ at: [0, deckY(d, wheelZ), wheelZ], yaw: 0, role: "wheel", of: -1 });
  // The officer of the watch beside him, arms folded, looking forward.
  push({ at: [1.3, deckY(d, wheelZ - 0.6), wheelZ - 0.6], yaw: -0.25, role: "officer", of: -1 });
  // A lookout in the maintop.
  const top = d.tops.reduce<{ y: number; z: number } | null>((best, t) => (Math.abs(t.z - main) < 1 && (!best || t.y < best.y) ? t : best), null);
  if (top) push({ at: [0.4, top.y + 0.1, top.z - 0.4], yaw: 0, role: "lookout", of: mainIndex });
  // Men along the taffrail, a breadth apart, looking aft over it.
  if (d.castle) {
    const stern = d.castle.ring[0]!;
    const row = Math.min(6, Math.max(0, Math.floor((stern.half * 1.6) / 0.8)));
    for (let i = 0; i < row; i++) {
      const x = row === 1 ? 0 : -stern.half * 0.8 + (stern.half * 1.6 * i) / (row - 1);
      push({ at: [x, d.castle.top, stern.z + 0.55 + 0.1 * spread(i, 1)], yaw: Math.PI + (spread(i, 2) - 0.5) * 0.3, role: "rail", of: -1 });
    }
  }
  // Two hands at the foot of each mast, at its halyards, facing it.
  model.def.masts.forEach((m, i) => {
    for (const s of [-1, 1]) {
      const z = m.z - 0.9;
      if (d.castle && z < d.castle.ring[d.castle.ring.length - 1]!.z) continue;
      push({ at: [s * 0.7, deckY(d, z), z], yaw: s * -0.6, role: "halyard", of: i });
    }
  });
  // Hands at the braces, by the sides abaft the mainmast, facing inboard.
  for (const s of [-1, 1]) {
    const z = main - 3.5;
    if (d.castle && z < d.castle.ring[d.castle.ring.length - 1]!.z) continue;
    const x = s * (d.side.halfAt(z) - 1.1);
    if (free(x, z)) push({ at: [x, deckY(d, z), z], yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, role: "brace", of: mainIndex });
  }
  // Gun crews: one man inboard of each broadside gun of the upper deck, facing the port; a quarter of the men at most.
  let guns = 0;
  d.guns.forEach((g, i) => {
    if (Math.abs(g.dir[0]) < 0.5) return;
    const side = Math.sign(g.dir[0]);
    const x = g.at[0] - side * (g.length / 2 + 0.7);
    const z = g.at[2];
    if (d.castle && z < d.castle.ring[d.castle.ring.length - 1]!.z) return;
    // Only the guns of the deck the men stand on (those of a lower deck are manned below, unseen).
    if (Math.abs(g.at[1] - 0.45 - deckY(d, z)) > 1.2) return;
    if (guns >= Math.ceil(total / 4)) return;
    guns++;
    if (Math.abs(x) < 0.6 || !free(x, z, 1.4)) return;
    push({ at: [x, deckY(d, z), z], yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, role: "gun", of: i });
  });
  // The rest in the waist: before the castle, abaft the bow, clear of masts, guns and one another.
  const aft = d.castle ? d.castle.ring[d.castle.ring.length - 1]!.z + 1.2 : -d.side.length * 0.4;
  const fore = d.side.length * 0.36;
  let k = 0;
  while (spots.length < total && k < total * 12) {
    const z = aft + (fore - aft) * spread(k, 3);
    const half = d.side.halfAt(z) - 1;
    const x = (spread(k, 4) * 2 - 1) * half * 0.75;
    k++;
    if (half < 0.6 || masts.some((mz) => Math.abs(mz - z) < 1.2 && Math.abs(x) < 1.2)) continue;
    if (d.guns.some((g) => Math.hypot(g.at[0] - x, g.at[2] - z) < 1.4) || !free(x, z, 0.9)) continue;
    push({ at: [x, deckY(d, z), z], yaw: spread(k, 5) * Math.PI * 2, role: "waist", of: -1 });
  }
  return spots;
};
