/**
 * Island trees as two parametric models (Weber and Penn, "Creation and rendering of realistic
 * trees", SIGGRAPH 1995: a tree from a handful of numbers, the stem's curve and taper, the number
 * of leaves, their length and droop): a coconut palm (a bent, tapering trunk and a crown of arching,
 * drooping fronds folded along their rib) and a broadleaf canopy tree (a short trunk under a crown
 * of overlapping lumps). Weber and Penn grow branches recursively; here each model has one level of
 * leaves only and a fixed shape, since thousands of instances share it (Flyweight: island-view
 * places, turns, scales and tints the instances). Height 1 to the crown: instances are scaled to
 * metres. Pure geometry with vertex colours, tested without a GPU.
 */
export interface TreeGeometry {
  positions: number[];
  indices: number[];
  colors: number[];
}

type Rgb = readonly [number, number, number];
const BARK: Rgb = [0.34, 0.27, 0.2];
const SCAR: Rgb = [0.42, 0.35, 0.26];
const FROND_BASE: Rgb = [0.2, 0.26, 0.1];
const FROND_TIP: Rgb = [0.4, 0.44, 0.18];
const LEAF_SHADE: Rgb = [0.09, 0.15, 0.06];
const LEAF_LIT: Rgb = [0.24, 0.33, 0.12];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class Builder {
  readonly g: TreeGeometry = { positions: [], indices: [], colors: [] };
  vertex(x: number, y: number, z: number, c: Rgb): number {
    this.g.positions.push(x, y, z);
    this.g.colors.push(c[0], c[1], c[2], 1);
    return this.g.positions.length / 3 - 1;
  }
  /** A tube along `centre(t)`, `radius(t)`, `rings` rings of `sides` vertices, wound outwards. */
  tube(rings: number, sides: number, centre: (t: number) => readonly [number, number, number], radius: (t: number) => number, colour: (ring: number) => Rgb): void {
    const first = this.g.positions.length / 3;
    for (let r = 0; r < rings; r++) {
      const t = r / (rings - 1);
      const [cx, cy, cz] = centre(t);
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        this.vertex(cx + Math.cos(a) * radius(t), cy, cz + Math.sin(a) * radius(t), colour(r));
      }
    }
    for (let r = 0; r < rings - 1; r++) {
      for (let s = 0; s < sides; s++) {
        const a = first + r * sides + s;
        const b = first + r * sides + ((s + 1) % sides);
        this.g.indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
  }
}

/** The palm's numbers (Weber and Penn's parameters for this model). */
export const PALM = {
  /** Sideways lean of the trunk's top, quadratic along it (palms lean out to the light). */
  bend: 0.16,
  trunkRadius: 0.032,
  fronds: 9,
  frondLength: 0.5,
  /** Rise of a frond near its base and its droop at the tip (parabola), in heights. */
  lift: 0.16,
  droop: 0.36,
  frondWidth: 0.075,
  segments: 6,
} as const;

/** Points of a frond's rib at s in [0, 1] from the crown: out along `dir`, up then down. */
export const frondRib = (s: number, dir: number, top: readonly [number, number, number]): [number, number, number] => {
  const out = PALM.frondLength * s;
  const up = PALM.lift * s - (PALM.lift + PALM.droop) * s * s;
  return [top[0] + Math.cos(dir) * out, top[1] + up, top[2] + Math.sin(dir) * out];
};

export const palmGeometry = (): TreeGeometry => {
  const b = new Builder();
  const centre = (t: number): [number, number, number] => [PALM.bend * t * t, t, 0];
  b.tube(8, 6, centre, (t) => PALM.trunkRadius * (1 - 0.35 * t), (r) => (r % 2 ? SCAR : BARK));
  const top = centre(1);
  for (let f = 0; f < PALM.fronds; f++) {
    // Golden-angle spacing with alternate fronds tilted: an even, unordered crown.
    const dir = f * 2.39996;
    const tilt = f % 2 ? 0.8 : 1.15;
    const first = b.g.positions.length / 3;
    for (let i = 0; i <= PALM.segments; i++) {
      const s = i / PALM.segments;
      const [x, y, z] = frondRib(s, dir, [top[0], top[1], top[2]]);
      const w = PALM.frondWidth * Math.sin(Math.PI * Math.min(1, s * 1.15 + 0.05)) * tilt;
      const c = mix(FROND_BASE, FROND_TIP, s);
      // Folded along the rib: the edges lower than the rib (a shallow V), across the frond.
      const px = -Math.sin(dir) * w;
      const pz = Math.cos(dir) * w;
      b.vertex(x - px, y - w * 0.45, z - pz, c);
      b.vertex(x, y, z, c);
      b.vertex(x + px, y - w * 0.45, z + pz, c);
    }
    for (let i = 0; i < PALM.segments; i++) {
      const a = first + i * 3;
      const n = a + 3;
      b.g.indices.push(a, n, a + 1, a + 1, n, n + 1, a + 1, n + 1, a + 2, a + 2, n + 1, n + 2);
    }
  }
  return b.g;
};

/** The broadleaf's crown: lumps (centre x, y, z and radius, in heights), overlapping. */
export const CANOPY: readonly (readonly [number, number, number, number])[] = [
  [0, 0.66, 0, 0.36],
  [0.26, 0.56, 0.1, 0.26],
  [-0.22, 0.58, -0.14, 0.28],
  [0.06, 0.86, -0.12, 0.24],
  [-0.08, 0.54, 0.26, 0.24],
];

export const broadleafGeometry = (): TreeGeometry => {
  const b = new Builder();
  b.tube(3, 5, (t) => [0, t * 0.5, 0], (t) => 0.045 * (1 - 0.4 * t), () => BARK);
  const LAT = 4;
  const LON = 7;
  for (const [cx, cy, cz, r] of CANOPY) {
    const first = b.g.positions.length / 3;
    for (let i = 0; i <= LAT; i++) {
      const v = (i / LAT) * Math.PI;
      for (let j = 0; j < LON; j++) {
        const u = (j / LON) * Math.PI * 2;
        // A lumpy surface (bunches of leaves): the radius ripples with the angles, flattened below.
        const k = r * (1 + 0.12 * Math.sin(u * 3 + i * 1.7) * Math.sin(v));
        const y = Math.cos(v) * k * (Math.cos(v) < 0 ? 0.55 : 0.8);
        // Lit from the sky above, in the shade of the crown below (fake ambient occlusion).
        const c = mix(LEAF_SHADE, LEAF_LIT, (Math.cos(v) + 1) / 2);
        b.vertex(cx + Math.sin(v) * Math.cos(u) * k, cy + y, cz + Math.sin(v) * Math.sin(u) * k, c);
      }
    }
    for (let i = 0; i < LAT; i++) {
      for (let j = 0; j < LON; j++) {
        const a = first + i * LON + j;
        const a1 = first + i * LON + ((j + 1) % LON);
        b.g.indices.push(a, a + LON, a1, a1, a + LON, a1 + LON);
      }
    }
  }
  return b.g;
};
