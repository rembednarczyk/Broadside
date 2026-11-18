import { type P } from "./state";

/**
 * A way round the islands (pure, deterministic): A* (Hart, Nilsson and Raphael, 1968) over a grid
 * of the seabed, eight neighbours, the octile distance as heuristic, ties broken by cell order;
 * then string pulling (each kept point is the last one visible from the one before it), so the
 * route is a few straight legs through open water instead of the grid's staircase. A leg that is
 * clear stays as it was given (a course drawn by the player is his).
 */
type Bed = (x: number, z: number) => number;

/** Grid cell (m): a quarter of a ship's turning circle, fine enough for the channels between islands. */
export const CELL = 40;
/** The search reaches this far round the leg (m), and at most this many cells a side. */
const MARGIN = 700;
const MAX_SIDE = 160;
/** Sampling step of a line-of-sight check (m). */
const STEP = 10;

/**
 * The seabed of a map read through a cache of its 40 m lattice (the cells A* asks for; other
 * points are computed as before): the islands do not move, so a second search over the same
 * water costs a lookup. One cache per map (`key`), dropped with it.
 */
const caches = new WeakMap<object, Bed>();
export const gridBed = (key: object, raw: Bed): Bed => {
  let bed = caches.get(key);
  if (!bed) {
    const cells = new Map<number, number>();
    bed = (x, z) => {
      if (x % CELL !== 0 || z % CELL !== 0) return raw(x, z);
      const k = (x / CELL + 32768) * 65536 + (z / CELL + 32768);
      let h = cells.get(k);
      if (h === undefined) {
        h = raw(x, z);
        cells.set(k, h);
      }
      return h;
    };
    caches.set(key, bed);
  }
  return bed;
};

/** Is the water along a straight leg deep enough (`keel`: the seabed must lie below it)? */
export const clearLeg = (bed: Bed, a: P, b: P, keel: number): boolean => {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
  for (let i = 0; i <= n; i++) if (bed(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n) >= keel) return false;
  return true;
};

/** A way from a to b through water deeper than `keel` (b included, a not), or null if there is none in reach. */
export const findWay = (bed: Bed, a: P, b: P, keel: number): P[] | null => {
  // On the world's 40 m lattice, so that the cells of every search are the same cells (gridBed caches them).
  const x0 = Math.floor((Math.min(a.x, b.x) - MARGIN) / CELL) * CELL;
  const z0 = Math.floor((Math.min(a.z, b.z) - MARGIN) / CELL) * CELL;
  const nx = Math.min(MAX_SIDE, Math.ceil((Math.max(a.x, b.x) + MARGIN - x0) / CELL));
  const nz = Math.min(MAX_SIDE, Math.ceil((Math.max(a.z, b.z) + MARGIN - z0) / CELL));
  const cellOf = (p: P): [number, number] => [Math.max(0, Math.min(nx - 1, Math.round((p.x - x0) / CELL))), Math.max(0, Math.min(nz - 1, Math.round((p.z - z0) / CELL)))];
  const centre = (i: number, k: number): P => ({ x: x0 + i * CELL, z: z0 + k * CELL });
  const open = new Uint8Array(nx * nz);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) open[k * nx + i] = bed(x0 + i * CELL, z0 + k * CELL) < keel ? 1 : 0;
  const [si, sk] = cellOf(a);
  const [gi, gk] = cellOf(b);
  const start = sk * nx + si;
  const goal = gk * nx + gi;
  open[start] = 1;
  open[goal] = 1;
  const g = new Float64Array(nx * nz).fill(Infinity);
  const from = new Int32Array(nx * nz).fill(-1);
  const h = (c: number): number => {
    const dx = Math.abs((c % nx) - gi);
    const dz = Math.abs(Math.floor(c / nx) - gk);
    return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * CELL;
  };
  // A binary heap on (f, cell): the cell number breaks ties, so the search is the same every run.
  const heap: [number, number][] = [];
  const less = (p: [number, number], q: [number, number]): boolean => p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]);
  const push = (e: [number, number]): void => {
    heap.push(e);
    for (let j = heap.length - 1; j > 0; ) {
      const up = (j - 1) >> 1;
      if (!less(heap[j]!, heap[up]!)) break;
      [heap[j], heap[up]] = [heap[up]!, heap[j]!];
      j = up;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let j = 0; ; ) {
        const l = j * 2 + 1;
        const r = l + 1;
        let m = j;
        if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
        if (m === j) break;
        [heap[j], heap[m]] = [heap[m]!, heap[j]!];
        j = m;
      }
    }
    return top;
  };
  g[start] = 0;
  push([h(start), start]);
  while (heap.length > 0) {
    const [, c] = pop();
    if (c === goal) break;
    const ci = c % nx;
    const ck = Math.floor(c / nx);
    for (let dk = -1; dk <= 1; dk++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dk === 0) continue;
        const i = ci + di;
        const k = ck + dk;
        if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
        const n = k * nx + i;
        // No cutting a corner of land: a diagonal step needs both sides open.
        if (!open[n] || (di !== 0 && dk !== 0 && (!open[ck * nx + i] || !open[k * nx + ci]))) continue;
        const cost = g[c]! + (di !== 0 && dk !== 0 ? Math.SQRT2 : 1) * CELL;
        if (cost < g[n]!) {
          g[n] = cost;
          from[n] = c;
          push([cost + h(n), n]);
        }
      }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const path: number[] = [];
  for (let c = goal; c !== start && c !== -1; c = from[c]!) path.unshift(c);
  // Line of sight over the grid already read (half-cell steps between cell centres): no new
  // reads of the seabed, so the string pulling costs next to nothing.
  const sees = (c0: number, c1: number): boolean => {
    const i0 = c0 % nx, k0 = Math.floor(c0 / nx), i1 = c1 % nx, k1 = Math.floor(c1 / nx);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(i1 - i0), Math.abs(k1 - k0)) * 2));
    for (let j = 1; j < n; j++) if (!open[Math.round(k0 + ((k1 - k0) * j) / n) * nx + Math.round(i0 + ((i1 - i0) * j) / n)]) return false;
    return true;
  };
  // String pulling: from each kept cell, on to the farthest one in sight.
  const out: P[] = [];
  let at = start;
  let j = 0;
  while (j < path.length) {
    let far = j;
    for (let m = path.length - 1; m > j; m--) {
      if (sees(at, path[m]!)) {
        far = m;
        break;
      }
    }
    out.push(path[far] === goal ? b : centre(path[far]! % nx, Math.floor(path[far]! / nx)));
    at = path[far]!;
    j = far + 1;
  }
  return out;
};

/** The route with a way round the land wherever a leg runs over it (legs in clear water as given). */
export const planRoute = (bed: Bed | null, from: P, route: readonly P[], keel: number): P[] => {
  if (!bed) return route.map((p) => ({ x: p.x, z: p.z }));
  const out: P[] = [];
  let at = from;
  for (const p of route) {
    const way = clearLeg(bed, at, p, keel) ? null : findWay(bed, at, p, keel);
    out.push(...(way ?? [{ x: p.x, z: p.z }]));
    at = p;
  }
  return out;
};
