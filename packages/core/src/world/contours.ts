import { DEEP_SEA, type Archipelago, terrainHeight } from "./archipelago";

/**
 * Contour lines of the land for the sea chart: the terrain sampled on a square grid, and the
 * isolines at a level traced by marching squares (Lorensen and Cline's marching cubes in two
 * dimensions: each cell's corners above or below the level pick which of its edges the line
 * crosses, the crossing placed by linear interpolation; the two saddle cases resolved by the
 * cell's mean) and chained into closed loops through the edges they share. The grid's outer ring
 * is held at the deep sea, so every loop closes: the mainland's runs along the chart's border.
 * Loops are unoriented; a chart fills them with the even-odd rule (lakes stay water).
 */
export interface HeightGrid {
  readonly x0: number;
  readonly z0: number;
  readonly cell: number;
  /** Nodes per row and per column. */
  readonly nx: number;
  readonly nz: number;
  /** Heights, row by row (index j * nx + i at x0 + i * cell, z0 + j * cell). */
  readonly h: Float32Array;
}

type P = { x: number; z: number };

/** The archipelago's terrain on a grid over its square (`cell` m apart), the outer ring held deep. */
export const heightGrid = (a: Archipelago, cell: number): HeightGrid => {
  const n = Math.ceil((2 * a.half) / cell) + 3;
  const x0 = -a.half - cell;
  const h = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
      h[j * n + i] = edge ? DEEP_SEA : terrainHeight(a, x0 + i * cell, x0 + j * cell);
    }
  }
  return { x0, z0: x0, cell, nx: n, nz: n, h };
};

// Edges of a cell: bottom (j row), right, top (j + 1 row), left; their pairs for each case of the corners inside
// (a = (i, j) 1, b = (i + 1, j) 2, c = (i + 1, j + 1) 4, d = (i, j + 1) 8). Saddles (5, 10) are decided apart.
const B = 0;
const R = 1;
const T = 2;
const L = 3;
const CASES: readonly (readonly [number, number])[][] = [[], [[L, B]], [[B, R]], [[L, R]], [[R, T]], [], [[B, T]], [[L, T]], [[T, L]], [[B, T]], [], [[R, T]], [[L, R]], [[B, R]], [[L, B]], []];

/** Closed contour loops of a grid at `level`. */
export const contourLoops = (g: HeightGrid, level: number): P[][] => {
  const { nx, nz, h, cell } = g;
  const at = (i: number, j: number): number => h[j * nx + i]!;
  // Edge ids: the horizontal edge from node (i, j) is 2k, the vertical one 2k + 1 (k = j * nx + i).
  const edgeId = (i: number, j: number, e: number): number => (e === B ? 2 * (j * nx + i) : e === T ? 2 * ((j + 1) * nx + i) : e === L ? 2 * (j * nx + i) + 1 : 2 * (j * nx + i + 1) + 1);
  const points = new Map<number, P>();
  const links = new Map<number, number[]>();
  const point = (id: number): P => {
    const known = points.get(id);
    if (known) return known;
    const k = id >> 1;
    const i = k % nx;
    const j = Math.floor(k / nx);
    const [i2, j2] = id & 1 ? [i, j + 1] : [i + 1, j];
    const h1 = at(i, j);
    const s = (level - h1) / (at(i2, j2) - h1);
    const p = { x: g.x0 + (i + (i2 - i) * s) * cell, z: g.z0 + (j + (j2 - j) * s) * cell };
    points.set(id, p);
    return p;
  };
  const link = (p: number, q: number) => {
    links.set(p, [...(links.get(p) ?? []), q]);
    links.set(q, [...(links.get(q) ?? []), p]);
  };
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const c = (at(i, j) > level ? 1 : 0) | (at(i + 1, j) > level ? 2 : 0) | (at(i + 1, j + 1) > level ? 4 : 0) | (at(i, j + 1) > level ? 8 : 0);
      let pairs = CASES[c]!;
      if (c === 5 || c === 10) {
        const centre = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 > level;
        pairs = (c === 5) === centre ? [[B, R], [T, L]] : [[L, B], [R, T]];
      }
      for (const [e1, e2] of pairs) link(edgeId(i, j, e1), edgeId(i, j, e2));
    }
  }
  const loops: P[][] = [];
  const seen = new Set<number>();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop: P[] = [];
    let prev = -1;
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(point(cur));
      const next = links.get(cur)!.find((n) => n !== prev && !seen.has(n));
      if (next === undefined) break;
      prev = cur;
      cur = next;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
};
