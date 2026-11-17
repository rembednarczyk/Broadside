/**
 * Sail cloth as a small grid in sail space: z along the chord (yard or boom), y up, x the normal
 * the cloth bulges along. The billow is a separable sine profile (maximum draft at mid chord and
 * mid height), the usual shape for a cambered sail; pure functions, updated each frame.
 */
export const SAIL_COLS = 12;
export const SAIL_ROWS = 8;
/**
 * A square yard is slung before its mast, not through it: the distance from the mast's axis to the
 * yard's (m), and the radius of the mast the canvas lies against when the sail is aback.
 */
export const YARD_CLEAR = 0.42;
export const MAST_GIRTH = 0.3;
/**
 * Which side of the sail's own plane (its +x or -x) is before the mast for a trim angle (the
 * rotation about the mast, Babylon's rotation.y): the sail's +x points to hull -z at +90 degrees.
 */
export const foreSide = (angle: number): 1 | -1 => (Math.sin(angle) <= 0 ? 1 : -1);

export type SailShape = "square" | "gaff" | "jib";

export interface SailOutline {
  readonly shape: SailShape;
  /** Chord length at the foot (square: yard width). */
  readonly width: number;
  readonly height: number;
  /** Height of the foot above the sail node. */
  readonly foot: number;
}

/** Texture coordinates of the cloth grid (u along the chord, v up). */
export const sailUvs = (): number[] => {
  const uv: number[] = [];
  for (let r = 0; r <= SAIL_ROWS; r++) for (let c = 0; c <= SAIL_COLS; c++) uv.push(c / SAIL_COLS, r / SAIL_ROWS);
  return uv;
};

export const sailIndices = (): number[] => {
  const idx: number[] = [];
  const row = SAIL_COLS + 1;
  for (let r = 0; r < SAIL_ROWS; r++) {
    for (let c = 0; c < SAIL_COLS; c++) {
      const a = r * row + c;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  return idx;
};

/**
 * Positions of the cloth for a set share (0..1: how much of the sail is spread) and a billow
 * (signed: + bulges to +x). Square sails gather up to the yard, fore-and-aft sails down to the boom.
 */
export const sailPositions = (o: SailOutline, set: number, billow: number, out: Float32Array): void => {
  const s = Math.max(0.04, Math.min(1, set));
  const h = o.height * s;
  let k = 0;
  for (let r = 0; r <= SAIL_ROWS; r++) {
    const v = r / SAIL_ROWS;
    for (let c = 0; c <= SAIL_COLS; c++) {
      const u = c / SAIL_COLS;
      let y: number;
      let z: number;
      if (o.shape === "square") {
        // Gathered towards the head (top) as the sail is taken in; slight taper upwards.
        y = o.foot + o.height - h + v * h;
        z = (u - 0.5) * o.width * (1 - 0.12 * v);
      } else if (o.shape === "gaff") {
        // Luff on the mast (z = 0), foot on the boom aft, gaff peaks the head aft and up.
        y = o.foot + v * h + u * v * h * 0.25;
        z = -u * o.width * (1 - 0.25 * v);
      } else {
        // Jib: tack at the bowsprit end (origin), luff up the forestay to the head near the
        // masthead, clew aft and low; u runs from the luff to the leech.
        const headZ = -o.width * 0.92;
        const luffY = o.foot + v * h;
        const luffZ = headZ * v;
        const leechY = o.foot + h * (0.1 + 0.9 * v);
        const leechZ = -o.width * 0.55 * (1 - v) + headZ * v;
        y = luffY + (leechY - luffY) * u;
        z = luffZ + (leechZ - luffZ) * u;
      }
      const draft = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)) * billow * o.width * 0.12;
      out[k++] = draft;
      out[k++] = y;
      out[k++] = z;
    }
  }
};
