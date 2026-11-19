/**
 * Standing rigging shot away (M11; Black Flag's chain shot cutting the rigging): as the ship's
 * rigging condition falls, more of her stays and shrouds part, each at its own threshold (a fixed
 * hash of the rope, so the same damage always parts the same ropes and a rope once parted stays
 * parted while the rigging only worsens). A parted rope hangs from its upper end, its loose end
 * swinging slowly (a pendulum's sway; not simulated), as many points as an intact one so the
 * same tube draws it.
 */

/** Threshold of rope `i`: it parts once the rigging falls below this (0.15..0.95). */
export const partsBelow = (i: number): number => {
  let h = (i + 1) * 2654435761;
  h = (h ^ (h >>> 15)) >>> 0;
  return 0.15 + ((h % 1000) / 1000) * 0.8;
};

export const isParted = (i: number, rigging: number): boolean => rigging < partsBelow(i);

/**
 * The points of a parted rope between `a` and `b` (same count as `n` + 1): it hangs from the higher
 * end for most of its length, the loose end swaying with `time`, never below `floor` (the deck or
 * the water).
 */
export const hangingRope = (a: readonly [number, number, number], b: readonly [number, number, number], i: number, time: number, floor: number, n = 6): [number, number, number][] => {
  const top = a[1] >= b[1] ? a : b;
  const span = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const length = span * 0.55;
  const phase = (i * 1.7) % (Math.PI * 2);
  const sway = Math.sin(time * 1.3 + phase) * 0.25;
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    // Straight down, swinging out more towards the loose end.
    const out = sway * t * length * 0.3;
    pts.push([top[0] + out, Math.max(floor, top[1] - length * t), top[2] + out * 0.5]);
  }
  return pts;
};
