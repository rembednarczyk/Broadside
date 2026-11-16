import { type HullShape, deckHeight, halfBreadth, keelDepth, stationZ } from "@broadside/core";
import { BULWARK, hullHeight } from "./hull-livery";

/**
 * Hull surface lofted from the same lines the physics samples (`core/hull/hull-shape.ts`):
 * stations along the length, points up each section from the keel to the deck edge, mirrored to
 * both sides, plus the deck, the transom and a bulwark rail. Pure geometry in hull space (origin
 * at the design waterline, midships), so it is tested without a GPU.
 */
export interface Geometry {
  positions: number[];
  indices: number[];
  uvs: number[];
}

const STATIONS = 40;
const RINGS = 12;

const push = (g: Geometry, x: number, y: number, z: number, u: number, v: number): number => {
  g.positions.push(x, y, z);
  g.uvs.push(u, v);
  return g.positions.length / 3 - 1;
};

const sideRing = (h: HullShape, u: number): { y: number; hb: number }[] => {
  const keel = -keelDepth(h, u);
  const deck = deckHeight(h, u) + BULWARK;
  const ring: { y: number; hb: number }[] = [];
  for (let r = 0; r <= RINGS; r++) {
    // Denser near the keel, where the section curves most.
    const t = r / RINGS;
    const y = keel + (deck - keel) * (1 - Math.pow(1 - t, 1.6));
    const hb = Math.max(halfBreadth(h, u, Math.min(y, deckHeight(h, u) - 1e-6)), r === 0 ? 0 : 0.02);
    ring.push({ y, hb: r === 0 ? 0 : hb });
  }
  return ring;
};

const sides = (g: Geometry, h: HullShape): void => {
  const height = hullHeight(h);
  for (const side of [-1, 1]) {
    const base = g.positions.length / 3;
    for (let s = 0; s <= STATIONS; s++) {
      const u = s / STATIONS;
      const z = stationZ(h, u);
      for (const p of sideRing(h, u)) push(g, side * p.hb, p.y, z, u, (p.y + h.draft) / height);
    }
    const row = RINGS + 1;
    for (let s = 0; s < STATIONS; s++) {
      for (let r = 0; r < RINGS; r++) {
        const a = base + s * row + r;
        const b = a + row;
        if (side > 0) g.indices.push(a, a + 1, b, b, a + 1, b + 1);
        else g.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
};

/** Deck planking as its own surface (own material): u across the beam, v along the length in metres / 4. */
export const deckGeometry = (h: HullShape): Geometry => {
  const g: Geometry = { positions: [], indices: [], uvs: [] };
  const base = 0;
  for (let s = 0; s <= STATIONS; s++) {
    const u = s / STATIONS;
    const y = deckHeight(h, u);
    const hb = Math.max(0.01, halfBreadth(h, u, y - 1e-6));
    const z = stationZ(h, u);
    push(g, -hb, y, z, 0, (u * h.length) / 4);
    push(g, hb, y, z, 1, (u * h.length) / 4);
  }
  for (let s = 0; s < STATIONS; s++) {
    const a = base + s * 2;
    g.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  return g;
};

const transom = (g: Geometry, h: HullShape): void => {
  const ring = sideRing(h, 0);
  const z = stationZ(h, 0);
  const centre = push(g, 0, (ring[0]!.y + ring[ring.length - 1]!.y) / 2, z, 0.001, 0.8);
  const pts = [...ring.map((p) => [p.hb, p.y] as const), ...[...ring].reverse().map((p) => [-p.hb, p.y] as const)];
  const ids = pts.map(([x, y]) => push(g, x, y, z, 0.001, (y + h.draft) / hullHeight(h)));
  for (let i = 0; i < ids.length - 1; i++) g.indices.push(centre, ids[i + 1]!, ids[i]!);
};

export const hullGeometry = (h: HullShape): Geometry => {
  const g: Geometry = { positions: [], indices: [], uvs: [] };
  sides(g, h);
  transom(g, h);
  return g;
};
