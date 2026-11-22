import { createRng } from "@broadside/core";

/**
 * A billow of powder smoke as a cluster of soft blobs (the classic "puff of puffs" sprite: Reeves,
 * "Particle Systems", 1983, builds fuzzy objects from many small elements; game smoke sprites are
 * made the same way and baked into an atlas, e.g. the flipbooks of Unreal's smoke). Seeded, so the
 * same seed draws the same sprite. Each blob is lit from above: the top of the cloud is brighter,
 * the underside shaded, which a flat radial gradient cannot show.
 */
export interface Blob {
  /** Centre in the cell, 0..1. */
  readonly x: number;
  readonly y: number;
  /** Radius in the cell, 0..1. */
  readonly r: number;
  /** 0..1 brightness from the light above. */
  readonly shade: number;
}

export const billowBlobs = (seed: number, count = 16): Blob[] => {
  const rng = createRng(seed);
  const blobs: Blob[] = [];
  for (let i = 0; i < count; i++) {
    // Denser in the middle: radius from the centre shrinks with the blob's size so it stays in the cell.
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * 0.22;
    const r = 0.1 + rng.next() * 0.14;
    const x = 0.5 + Math.cos(a) * d;
    const y = 0.5 + Math.sin(a) * d * 0.8;
    blobs.push({ x, y, r: Math.min(r, 0.48 - Math.hypot(x - 0.5, y - 0.5)), shade: 0.72 + 0.28 * (1 - (y - 0.28) / 0.44) });
  }
  // Painted back to front: the lower (shaded) blobs first, the lit tops over them.
  return blobs.sort((p, q) => q.y - p.y);
};
