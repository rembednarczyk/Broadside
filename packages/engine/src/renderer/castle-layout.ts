import { type GunPlace } from "./gun-layout";
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
  /** Gun ports cut in the walls for the guns that stand inside the castle. */
  readonly ports: readonly CastlePort[];
  /** The flat transom under the castle, down towards the water: its foot's height and half-width. */
  readonly transom: { readonly foot: number; readonly half: number };
}

/** A gun port: the gun it serves (index in the ship's mounts), its middle on the wall and the wall's outward normal. */
export interface CastlePort {
  readonly gun: number;
  readonly at: readonly [number, number, number];
  readonly n: readonly [number, number, number];
}

/**
 * The ship's wheel stands on the castle's deck this far abaft its break (m); the helmsman stands
 * WHEEL_REACH abaft the wheel, facing it and the bow.
 */
export const WHEEL_ABAFT = 1.0;
export const WHEEL_REACH = 0.6;

/** Height of the castle's walls, of its balustrade and of a lantern on its post (m). */
export const CASTLE_WALL = 2.2;
export const BALUSTRADE = 0.95;
const LANTERN_POST = 0.7;
/** The sterncastle is at least this share of the hull's greatest breadth (a broad, square stern). */
const BROAD_STERN = 0.82;
/** The flat transom comes down to this height above the waterline (m). */
const TRANSOM_FOOT = 0.9;
/** The castle covers this share of the length from the stern (the reference's is about a quarter). */
const SHARE = 0.24;

/**
 * Ports for the guns whose barrels lie within the castle (between its floor and its deck, inside
 * its length): a broadside gun fires through the side wall at its station, a stern chaser through
 * the transom. Without a port such a barrel would stand through plain planking.
 */
const portsFor = (ring: CastleLayout["ring"], base: number, top: number, guns: readonly GunPlace[]): CastlePort[] => {
  const stern = ring[0]!;
  const last = ring[ring.length - 1]!;
  const halfAt = (z: number): number => {
    const i = Math.max(0, Math.min(ring.length - 2, ring.findIndex((r) => r.z > z) - 1));
    const t = Math.max(0, Math.min(1, (z - ring[i]!.z) / (ring[i + 1]!.z - ring[i]!.z)));
    return ring[i]!.half + (ring[i + 1]!.half - ring[i]!.half) * t;
  };
  const ports: CastlePort[] = [];
  guns.forEach((g, gun) => {
    const [x, y, z] = g.at;
    if (y + 0.2 < base || y - 0.2 > top || z < stern.z - g.length || z > last.z + 0.2) return;
    if (Math.abs(g.dir[0]) > 0.5 && z > stern.z) ports.push({ gun, at: [Math.sign(g.dir[0]) * halfAt(z), y, z], n: [Math.sign(g.dir[0]), 0, 0] });
    else if (g.dir[2] < -0.5 && Math.abs(x) < stern.half) ports.push({ gun, at: [x, y, stern.z], n: [0, 0, -1] });
  });
  return ports;
};

export const sternCastle = (side: SideProfile, guns: readonly GunPlace[] = []): CastleLayout | null => {
  const caps = side.deckCaps().filter((run) => run[0]!.z < 0);
  if (caps.length === 0) return null;
  const end = -side.length * (0.5 - SHARE);
  const stations = Array.from({ length: side.stations }, (_, k) => side.zOf(k)).filter((z) => z <= end);
  if (stations.length < 2) return null;
  const ys = caps.flat().filter((s) => s.z <= end).map((s) => s.y).sort((a, b) => a - b);
  const base = ys[ys.length >> 1] ?? side.topAt(stations[0]!) - 0.95;
  const step = stations[1]! - stations[0]!;
  // Carried half a station on at each end, to the transom and to the break of the castle.
  // A galleon's sterncastle stands broad over the run of the hull (ref_090: the stern a tall,
  // flat slab nearly as wide as the main yard): never narrower than BROAD_STERN of the widest.
  const widest = Math.max(...stations.map((z) => side.halfAt(z)));
  const ring = stations.map((z, i) => ({ z: z + (i === 0 ? -step / 2 : i === stations.length - 1 ? step / 2 : 0), half: Math.max(side.halfAt(z), widest * BROAD_STERN) * 1.01 }));
  const top = base + CASTLE_WALL;
  const stern = ring[0]!;
  const y = top + BALUSTRADE + LANTERN_POST;
  return { ring, base, top, waist: side.topAt(end + step * 2) - 0.95, lanterns: [[0, y + 0.25, stern.z], [-stern.half * 0.72, y, stern.z], [stern.half * 0.72, y, stern.z]], ports: portsFor(ring, base, top, guns), transom: { foot: TRANSOM_FOOT, half: Math.max(0.6, side.halfAt(stations[0]!) * 0.85) } };
};
