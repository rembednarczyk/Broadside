/**
 * Seeded pseudo-random generator (mulberry32, Tommy Ettinger's public-domain generator, as in
 * SpinalTap core/math). The only source of randomness in core and sim (ADR-0003).
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Current internal state; restoring it replays the same sequence. */
  state(): number;
}

export const createRng = (seed: number): Rng => {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => s,
  };
};

export const range = (rng: Rng, lo: number, hi: number): number => lo + (hi - lo) * rng.next();
export const intRange = (rng: Rng, lo: number, hiInclusive: number): number => lo + Math.floor(rng.next() * (hiInclusive - lo + 1));
export const pick = <T>(rng: Rng, items: readonly T[]): T => {
  const item = items[Math.floor(rng.next() * items.length)];
  if (item === undefined) throw new Error("pick from an empty list");
  return item;
};
/** Approximately normal (sum of four uniforms, Irwin-Hall), mean 0, deviation ~1. */
export const gauss = (rng: Rng): number => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.732;

/** Stable 32-bit hash of a string (FNV-1a); seeds sub-generators by name. */
export const hashString = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Derives an independent generator for a named stream from a world seed. */
export const subRng = (seed: number, stream: string): Rng => createRng((seed ^ hashString(stream)) >>> 0);
