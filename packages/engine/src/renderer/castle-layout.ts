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
  /** A forecastle (built mirrored, see `foreCastle`): no wheel and no gallery windows. */
  readonly fore?: boolean;
}

/** What a castle needs of the hull's side (SideProfile, or its mirror image for the bow). */
export type CastleSide = Pick<SideProfile, "length" | "stations" | "zOf" | "halfAt" | "topAt" | "deckCaps">;

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

export const sternCastle = (side: CastleSide, guns: readonly GunPlace[] = []): CastleLayout | null => castleOn(side, guns, { share: SHARE, wall: CASTLE_WALL, needCaps: true });

interface CastleSpec {
  /** Share of the length it covers, its walls' height, whether it stands only where the cut opened the deck. */
  readonly share: number;
  readonly wall: number;
  readonly needCaps: boolean;
}

const castleOn = (side: CastleSide, guns: readonly GunPlace[], spec: CastleSpec): CastleLayout | null => {
  const caps = side.deckCaps().filter((run) => run[0]!.z < 0);
  if (spec.needCaps && caps.length === 0) return null;
  const end = -side.length * (0.5 - spec.share);
  const stations = Array.from({ length: side.stations }, (_, k) => side.zOf(k)).filter((z) => z <= end);
  if (stations.length < 2) return null;
  const ys = caps.flat().filter((s) => s.z <= end).map((s) => s.y).sort((a, b) => a - b);
  // Without a cut deck to stand on, the floor is the lowest deck under the castle (the walls run
  // down into the hull where its sheer rises).
  const base = ys[ys.length >> 1] ?? Math.min(...stations.map((z) => side.topAt(z))) - 0.95;
  const step = stations[1]! - stations[0]!;
  // Carried half a station on at each end, to the transom and to the break of the castle.
  const ring = stations.map((z, i) => ({ z: z + (i === 0 ? -step / 2 : i === stations.length - 1 ? step / 2 : 0), half: side.halfAt(z) * 1.01 }));
  // Over a bow whose sheer rises, the deck stands clear of the highest bulwark under it.
  const top = Math.max(base + spec.wall, spec.needCaps ? -Infinity : Math.max(...stations.map((z) => side.topAt(z))) + 0.35);
  const stern = ring[0]!;
  const y = top + BALUSTRADE + LANTERN_POST;
  return { ring, base, top, waist: side.topAt(end + step * 2) - 0.95, lanterns: [[0, y + 0.25, stern.z], [-stern.half * 0.72, y, stern.z], [stern.half * 0.72, y, stern.z]], ports: portsFor(ring, base, top, guns) };
};

/** Height of the forecastle's walls (m): lower than the sterncastle's, as in the reference's side view (ref_064). */
export const FORE_WALL = 1.7;

/**
 * The forecastle: a lower, shorter castle over the bow, ending `clear` metres before the
 * foremast (its men and shrouds keep the deck there). Laid out as a sterncastle on the side seen
 * from the other end (z mirrored) and so built: the mesh goes under a node mirrored in z, and its
 * layout is returned in the mirrored frame (`fore`), with no lanterns.
 */
export const foreCastle = (side: CastleSide, foremastZ: number, guns: readonly GunPlace[] = [], clear = 2.5): CastleLayout | null => {
  const n = side.stations;
  const mirror: CastleSide = {
    length: side.length,
    stations: n,
    zOf: (k) => -side.zOf(n - 1 - k),
    halfAt: (z) => side.halfAt(-z),
    topAt: (z) => side.topAt(-z),
    deckCaps: (b) => side.deckCaps(b).map((run) => run.map((c) => ({ ...c, z: -c.z })).reverse()),
  };
  const share = Math.min(0.16, 0.5 - (foremastZ + clear) / side.length);
  if (share < 0.06) return null;
  const mirroredGuns = guns.map((g) => ({ ...g, at: [g.at[0], g.at[1], -g.at[2]] as const, dir: [g.dir[0], g.dir[1], -g.dir[2]] as const }));
  const c = castleOn(mirror, mirroredGuns, { share, wall: FORE_WALL, needCaps: false });
  return c && { ...c, lanterns: [], fore: true };
};
