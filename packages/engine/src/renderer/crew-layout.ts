import { type ShipModel } from "@broadside/sim";
import { type CastleLayout } from "./castle-layout";
import { type GunPlace } from "./gun-layout";
import { type SideProfile } from "./side-profile";

/**
 * Where the crew stand on a modelled hull (pure layout, tested): a row of men along the
 * balustrade of the sterncastle, looking aft (the reference's stern shots show six to eight there,
 * ref_090), and the rest about the waist, between the guns and clear of the masts. Positions are
 * the feet of each figure in hull space; a fixed integer sequence spreads them, no random source.
 */
export interface CrewSpot {
  readonly at: readonly [number, number, number];
  /** Rotation about the vertical (radians): which way the man faces. */
  readonly yaw: number;
}

/** How many figures a crew is drawn with: one for every six hands, at most forty. */
export const crewFigures = (crew: number): number => Math.min(40, Math.round(crew / 6));

const frac = (v: number): number => v - Math.floor(v);
const spread = (i: number, salt: number): number => frac(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453);

export const modelCrewSpots = (model: ShipModel, side: SideProfile, castle: CastleLayout | null, guns: readonly GunPlace[]): CrewSpot[] => {
  const total = crewFigures(model.def.crew);
  const spots: CrewSpot[] = [];
  if (castle) {
    // Along the stern rail, a man's breadth apart, facing aft over the taffrail.
    const stern = castle.ring[0]!;
    const row = Math.min(total, 7, Math.max(0, Math.floor((stern.half * 1.6) / 0.8)));
    for (let i = 0; i < row; i++) {
      const x = row === 1 ? 0 : -stern.half * 0.8 + (stern.half * 1.6 * i) / (row - 1);
      spots.push({ at: [x, castle.top, stern.z + 0.7 + 0.2 * spread(i, 1)], yaw: Math.PI + (spread(i, 2) - 0.5) * 0.6 });
    }
  }
  // The rest in the waist: before the castle, abaft the bow, clear of masts and gun carriages.
  const aft = castle ? castle.ring[castle.ring.length - 1]!.z + 1.2 : -side.length * 0.4;
  const fore = side.length * 0.36;
  const masts = model.def.masts.map((m) => m.z);
  let k = 0;
  while (spots.length < total && k < total * 12) {
    const z = aft + (fore - aft) * spread(k, 3);
    const half = side.halfAt(z) - 1;
    const x = (spread(k, 4) * 2 - 1) * half * 0.75;
    k++;
    if (half < 0.6 || masts.some((mz) => Math.abs(mz - z) < 1.2 && Math.abs(x) < 1.2)) continue;
    if (guns.some((g) => Math.hypot(g.at[0] - x, g.at[2] - z) < 1.4)) continue;
    if (spots.some((s) => Math.hypot(s.at[0] - x, s.at[2] - z) < 0.9)) continue;
    spots.push({ at: [x, castle ? castle.waist : side.topAt(z) - 0.95, z], yaw: spread(k, 5) * Math.PI * 2 });
  }
  return spots;
};
