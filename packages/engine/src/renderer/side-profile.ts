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
}

/** The fit of the model to the physics hull (HullModels.instantiate): scales and the keel's depth. */
export interface HullFit {
  readonly kx: number;
  readonly ky: number;
  readonly draft: number;
  /** Length of the model (model units). */
  readonly length: number;
}

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

  constructor(data: SideProfileData, private readonly fit: HullFit) {
    this.half = data.half.map((_, k) => median(data.half, k, 3) * fit.kx);
    this.top = data.top.map((_, k) => median(data.top, k, 2) * fit.ky - fit.draft);
    this.rawTop = data.top.map((y) => y * fit.ky - fit.draft);
  }

  get stations(): number {
    return this.half.length;
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
