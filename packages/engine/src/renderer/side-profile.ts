/**
 * The side of a modelled hull as the asset tool measured it (tools/assets/hull-cut.mjs): in equal
 * stations from stern to bow, the half-breadth near the top of the side and the height of the
 * bulwark's top, in model units. The game's own fittings stand on it: the rail, the channels, the
 * feet of the shrouds. Pure functions (tested); the measures are noisy (gun ports, carvings, scan
 * artefacts), so they are read through a running median, the usual despeckling filter.
 */
export interface SideProfileData {
  readonly half: readonly number[];
  readonly top: readonly number[];
  /** Height at which the model was cut (model units): a side that reaches it was sliced through. */
  readonly cut?: number;
}

/** The fit of the model to the physics hull (HullModels.instantiate): scales and the keel's depth. */
export interface HullFit {
  readonly kx: number;
  readonly ky: number;
  readonly draft: number;
  /** Length of the model (model units). */
  readonly length: number;
}

/** Height of the bulwark above the deck the physics hull is built to (m). */
const BULWARK = 0.8;

/** Scales that fit a model to a physics hull: the beam to its beam, the gunwale to its deck plus a bulwark. */
export const hullFit = (m: { beam: number; gunwale: number }, hull: { beam: number; draft: number; freeboard: number }): { kx: number; ky: number } => ({ kx: hull.beam / m.beam, ky: (hull.draft + hull.freeboard + BULWARK) / m.gunwale });

const median = (v: readonly number[], k: number, window: number): number => {
  const part = v.slice(Math.max(0, k - window), Math.min(v.length, k + window + 1)).filter((x) => x > 0);
  if (part.length === 0) return 0;
  part.sort((a, b) => a - b);
  return part[part.length >> 1]!;
};

export class SideProfile {
  private readonly half: number[];
  private readonly top: number[];
  /** The bulwark's top as measured, before smoothing (hull space, metres). */
  private readonly rawTop: number[];
  private readonly cutTop: number;

  constructor(data: SideProfileData, private readonly fit: HullFit) {
    this.half = data.half.map((_, k) => median(data.half, k, 3) * fit.kx);
    this.top = data.top.map((_, k) => median(data.top, k, 2) * fit.ky - fit.draft);
    this.rawTop = data.top.map((y) => y * fit.ky - fit.draft);
    this.cutTop = data.cut === undefined ? Infinity : data.cut * fit.ky - fit.draft;
  }

  get stations(): number {
    return this.half.length;
  }

  /** Length of the fitted model (hull space, metres). */
  get length(): number {
    return this.fit.length * this.fit.kx;
  }

  /** Hull-space z of the middle of station k. */
  zOf(k: number): number {
    return ((k + 0.5) / this.stations - 0.5) * this.fit.length * this.fit.kx;
  }

  private station(z: number): number {
    return Math.max(0, Math.min(this.stations - 1, Math.floor((z / (this.fit.length * this.fit.kx) + 0.5) * this.stations)));
  }

  /** Half-breadth of the side at z (hull space, metres). */
  halfAt(z: number): number {
    return this.half[this.station(z)]!;
  }

  /** Height of the bulwark's top at z (hull space, metres above the waterline). */
  topAt(z: number): number {
    return this.top[this.station(z)]!;
  }

  /**
   * Decks the model lost to the cut: where the side stands right up to the height the model was
   * cut at, the cut went through a castle and left it open from above. Each run of such stations
   * is closed with a deck a bulwark's height below the top: strips of [half-breadth, y, z].
   */
  deckCaps(bulwark = 0.95): { half: number; y: number; z: number }[][] {
    const caps: { half: number; y: number; z: number }[][] = [];
    let run: { half: number; y: number; z: number }[] = [];
    for (let k = 0; k < this.stations; k++) {
      // Within a twentieth of the hull's height of the cut (the measured tops are ragged).
      const sliced = this.half[k]! > 0.3 && this.top[k]! >= this.cutTop - 0.06 * (this.cutTop + this.fit.draft);
      if (sliced) run.push({ half: this.half[k]! * 0.97, y: this.top[k]! - bulwark, z: this.zOf(k) });
      if ((!sliced || k === this.stations - 1) && run.length > 0) {
        if (run.length > 1) caps.push(run);
        run = [];
      }
    }
    return caps;
  }

  /** Stations forward of `from` where the cut left the deck open (not sliced): z, the bulwark's top and the half-breadth, to measure the deck at. */
  deckStations(from = -Infinity): { k: number; z: number; top: number; half: number }[] {
    const out: { k: number; z: number; top: number; half: number }[] = [];
    for (let k = 0; k < this.stations; k++) {
      const z = this.zOf(k);
      const sliced = this.top[k]! >= this.cutTop - 0.06 * (this.cutTop + this.fit.draft);
      if (z >= from && !sliced && this.half[k]! > 0.3) out.push({ k, z, top: this.top[k]!, half: this.half[k]! });
    }
    return out;
  }

  /**
   * The model's open decks (the waist and a forecastle) as strips of [half-breadth, y, z] at the
   * heights measured at `deckStations` (`ys`, null where no deck was found); a run breaks at a
   * gap and where the deck steps up or down.
   */
  openDecks(stations: readonly { k: number; z: number; half: number }[], measured: readonly (number | null)[]): { half: number; y: number; z: number }[][] {
    // Where the model has no deck at all (a hollow waist), the deck goes on at the level abaft it;
    // single readings off a hatch or a gun are dropped by a running median of three.
    const held: (number | null)[] = [];
    stations.forEach((s, i) => {
      const prev = i > 0 && stations[i - 1]!.k === s.k - 1 ? held[i - 1]! : null;
      held.push(measured[i] ?? prev);
    });
    // (Of two readings at the end of a run the lower: fittings stand on the deck, not under it.)
    const ys = held.map((y, i) => {
      if (y === null) return null;
      const near = held.slice(Math.max(0, i - 1), i + 2).filter((v): v is number => v !== null).sort((a, b) => a - b);
      return near[(near.length - 1) >> 1]!;
    });
    const runs: { half: number; y: number; z: number }[][] = [];
    let run: { half: number; y: number; z: number }[] = [];
    let last = -2;
    const close = () => {
      if (run.length > 1) runs.push(run);
      run = [];
    };
    stations.forEach((s, i) => {
      const y = ys[i];
      const prev = run[run.length - 1];
      if (y === null || y === undefined || s.k !== last + 1 || (prev && Math.abs(prev.y - y) > 0.3)) close();
      last = s.k;
      if (y !== null && y !== undefined) run.push({ half: s.half * 0.97, y, z: s.z });
    });
    close();
    return runs;
  }

  /**
   * Runs of rail along one side: the smoothed top of the bulwark from stern to bow, broken where
   * it steps (the breaks of the castles), as polylines [x, y, z] for `side` (+1 starboard).
   * `gaps[k]` tells where the model's own bulwark falls short of the rail (a post goes there).
   */
  railRuns(side: 1 | -1, step = 0.7): { runs: [number, number, number][][]; posts: { x: number; z: number; from: number; to: number }[] } {
    const runs: [number, number, number][][] = [];
    const posts: { x: number; z: number; from: number; to: number }[] = [];
    let run: [number, number, number][] = [];
    for (let k = 0; k < this.stations; k++) {
      const half = this.half[k]!;
      const top = this.top[k]!;
      if (half <= 0.3 || top <= 0) continue;
      const prev = run[run.length - 1];
      if (prev && Math.abs(prev[1] - top) > step) {
        if (run.length > 1) runs.push(run);
        run = [];
      }
      run.push([side * half, top, this.zOf(k)]);
      // The model's bulwark is lower here than the line of the rail: a stanchion carries the rail.
      if (top - this.rawTop[k]! > 0.2) posts.push({ x: side * half, z: this.zOf(k), from: Math.max(this.rawTop[k]!, top - 1.1), to: top });
    }
    if (run.length > 1) runs.push(run);
    return { runs, posts };
  }
}
