/**
 * A furled square sail as one shared mesh (pure, tested): the canvas rolled up on top of its yard
 * and stopped with gaskets, as the seamanship manuals draw it (Lever, "The Young Sea Officer's
 * Sheet Anchor", 1808, furling: the bunt, the bulk of the sail gathered at the middle, the rest
 * rolled out to the yardarms and passed with gaskets). Built in a unit space the yard's thin
 * instance scales: y runs along the yard (-0.5 to 0.5), x and z across it (diameter 1), +z
 * hanging down. The roll is thickest in the bunt, thins towards the arms, is pinched where the
 * two gaskets bind it and sags between them in a bight; its surface is lumpy where the folds lie.
 * UVs take the canvas texture's middle (cloths running round the roll; clear of the frayed foot at
 * v = 0) and, for the gaskets, the dark tabling of the head (v near 1).
 */
export interface FurlGeometry {
  readonly positions: number[];
  readonly normals: number[];
  readonly uvs: number[];
  readonly indices: number[];
}

/** Where the gaskets bind the roll (fraction of the length from the middle). */
export const GASKETS = [-0.3, 0.3] as const;
const SIDES = 12;
const RINGS = 40;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Radius of the roll at `t` (diameter 1 at its fullest) and how far it hangs down there. */
export const furlSection = (t: number): { r: number; sag: number } => {
  const a = Math.abs(t);
  const bunt = 0.62 + 0.38 * Math.exp(-((t / 0.17) ** 2));
  const taper = 0.22 + 0.78 * smooth(0.5, 0.34, a);
  const pinch = 1 - Math.max(...GASKETS.map((g) => 0.45 * Math.exp(-(((t - g) / 0.03) ** 2))));
  // A deep bight between the gaskets (the bunt hangs in it), and a shorter one out to each arm.
  const sag = a < 0.3 ? 0.3 * Math.cos((Math.PI * t) / 0.6) : 0.12 * Math.sin((Math.PI * (a - 0.3)) / 0.2);
  return { r: 0.5 * bunt * taper * pinch, sag };
};

export const furlGeometry = (): FurlGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ring = (t: number, r: number, sag: number, v0: number, v1: number, lumpy: boolean): void => {
    for (let k = 0; k <= SIDES; k++) {
      const phi = (k / SIDES) * Math.PI * 2;
      // Folds: a few lumps round the roll, shifting along it (fixed numbers, the same every ship).
      const fold = lumpy ? 1 + 0.11 * Math.sin(phi * 3 + t * 23) + 0.07 * Math.sin(phi * 5 - t * 41) + 0.05 * Math.sin(phi * 9 + t * 67) : 1;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      positions.push(c * r * fold, t, s * r * fold + sag);
      normals.push(c, 0, s);
      uvs.push(0.5 + t * 0.9, v0 + (v1 - v0) * (k / SIDES));
    }
  };
  const strip = (first: number, rings: number): void => {
    for (let i = 0; i < rings - 1; i++) {
      for (let k = 0; k < SIDES; k++) {
        const a = first + i * (SIDES + 1) + k;
        const b = a + SIDES + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  };
  // The roll, closed at each end by a ring of radius 0 (the canvas gathered into the yardarm).
  for (let i = 0; i <= RINGS; i++) {
    const t = -0.5 + i / RINGS;
    const { r, sag } = furlSection(t);
    ring(t, i === 0 || i === RINGS ? 0 : r, sag, 0.25, 0.68, true);
  }
  strip(0, RINGS + 1);
  // The gaskets round the roll at each tie.
  for (const g of GASKETS) {
    const { r, sag } = furlSection(g);
    // Two turns of the gasket, each a band of rope standing proud of the roll.
    for (const turn of [-0.007, 0.007]) {
      const at = positions.length / 3;
      for (const dt of [-0.0035, 0.0035]) ring(g + turn + dt, r * 1.12 + 0.06, sag, 0.988, 0.997, false);
      strip(at, 2);
    }
  }
  return { positions, normals, uvs, indices };
};
