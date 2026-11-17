import { type SideProfile } from "./side-profile";

/**
 * The sterncastle raised on a modelled hull (pure layout, shared by the mesh builder and the parts
 * list). The reference ship carries a high, flat-topped castle aft with a balustrade all round,
 * gallery windows and stern lanterns; the owner's models end in a low quarterdeck that the cut
 * leaves open. The castle stands on the stations the cut sliced through (`SideProfile.deckCaps`),
 * its walls carrying the hull's side straight up, from the stern forward over a quarter of the length.
 */
export interface CastleLayout {
  /** Stations from the transom forward: z and the half-breadth of the castle's wall there. */
  readonly ring: readonly { readonly z: number; readonly half: number }[];
  /** Height of the castle's floor and of its deck above the waterline. */
  readonly base: number;
  readonly top: number;
  /** Deck of the waist before the castle (the stairs come down to it). */
  readonly waist: number;
  /** Stern lanterns on the taffrail: [x, y, z]. */
  readonly lanterns: readonly (readonly [number, number, number])[];
}

/** Height of the castle's walls, of its balustrade and of a lantern on its post (m). */
export const CASTLE_WALL = 2.2;
export const BALUSTRADE = 0.95;
const LANTERN_POST = 0.7;
/** The castle covers this share of the length from the stern (the reference's is about a quarter). */
const SHARE = 0.24;

export const sternCastle = (side: SideProfile): CastleLayout | null => {
  const caps = side.deckCaps().filter((run) => run[0]!.z < 0);
  if (caps.length === 0) return null;
  const end = -side.length * (0.5 - SHARE);
  const stations = Array.from({ length: side.stations }, (_, k) => side.zOf(k)).filter((z) => z <= end);
  if (stations.length < 2) return null;
  const ys = caps.flat().filter((s) => s.z <= end).map((s) => s.y).sort((a, b) => a - b);
  const base = ys[ys.length >> 1] ?? side.topAt(stations[0]!) - 0.95;
  const step = stations[1]! - stations[0]!;
  // Carried half a station on at each end, to the transom and to the break of the castle.
  const ring = stations.map((z, i) => ({ z: z + (i === 0 ? -step / 2 : i === stations.length - 1 ? step / 2 : 0), half: side.halfAt(z) * 1.01 }));
  const top = base + CASTLE_WALL;
  const stern = ring[0]!;
  const y = top + BALUSTRADE + LANTERN_POST;
  return { ring, base, top, waist: side.topAt(end + step * 2) - 0.95, lanterns: [[0, y + 0.25, stern.z], [-stern.half * 0.72, y, stern.z], [stern.half * 0.72, y, stern.z]] };
};
