import { describe, expect, it } from "vitest";
import { MAST_GIRTH, SAIL_COLS, SAIL_ROWS, type SailOutline, YARD_CLEAR } from "../src/renderer/sail-geometry";
import { SailSim } from "../src/renderer/sail-sim";

const square: SailOutline = { shape: "square", width: 12, height: 9, foot: 6 };
const at = (r: number, c: number): number => (r * (SAIL_COLS + 1) + c) * 3;
const run = (o: SailOutline, seconds: number, set: number, drive: number, wind: number, flutter = 0): SailSim => {
  const s = new SailSim(o);
  for (let i = 0; i < seconds * 60; i++) s.advance(1 / 60, set, drive, wind, flutter);
  return s;
};
const mid = at(SAIL_ROWS / 2, SAIL_COLS / 2);

describe("sailcloth simulation", () => {
  it("fills to leeward with a belly of about a tenth of the chord, held at the yard and the clews", () => {
    const s = run(square, 6, 1, 1, 10);
    const p = s.positions;
    expect(p.every(Number.isFinite)).toBe(true);
    expect(p[mid]! / square.width).toBeGreaterThan(0.05);
    expect(p[mid]! / square.width).toBeLessThan(0.2);
    // The head stays on the yard and the clews on their sheets.
    for (let c = 0; c <= SAIL_COLS; c++) expect(p[at(SAIL_ROWS, c)]).toBeCloseTo(0, 6);
    expect(p[at(0, 0)]).toBeCloseTo(0, 6);
    expect(p[at(0, SAIL_COLS)]).toBeCloseTo(0, 6);
    // Aback, the belly goes the other way.
    expect(run(square, 6, 1, -1, 10).positions[mid]).toBeLessThan(-0.5);
  });

  it("is deterministic and does not depend on how the frames fall", () => {
    const a = run(square, 3, 1, 0.8, 9, 0.3).positions;
    const b = run(square, 3, 1, 0.8, 9, 0.3).positions;
    expect(Array.from(a)).toEqual(Array.from(b));
    const c = new SailSim(square);
    for (let i = 0; i < 3 * 30; i++) c.advance(1 / 30, 1, 0.8, 9, 0.3);
    expect(Array.from(c.positions)).toEqual(Array.from(a));
  });

  it("hangs slack in a calm and draws harder in more wind", () => {
    const calm = run(square, 6, 1, 0.3, 0.5).positions;
    const breeze = run(square, 6, 1, 1, 6).positions;
    const gale = run(square, 6, 1, 1, 18).positions;
    expect(Math.abs(calm[mid]!)).toBeLessThan(Math.abs(breeze[mid]!));
    // The foot of a slack sail droops below where the sheets hold the clews.
    expect(calm[at(0, SAIL_COLS / 2) + 1]!).toBeLessThan(square.foot);
    // Canvas does not stretch: the belly is set by the cut of the sail, not by the wind's strength.
    expect(gale[mid]! / breeze[mid]!).toBeLessThan(1.35);
    expect(gale[mid]!).toBeGreaterThanOrEqual(breeze[mid]! * 0.95);
  });

  it("keeps its threads' length (canvas does not stretch)", () => {
    const p = run(square, 6, 1, 1.2, 20).positions;
    const flatCell = square.width / SAIL_COLS;
    for (let r = 0; r <= SAIL_ROWS; r++) {
      for (let c = 0; c < SAIL_COLS; c++) {
        const a = at(r, c);
        const b = at(r, c + 1);
        expect(Math.hypot(p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!)).toBeLessThan(flatCell * 1.09);
      }
    }
  });

  it("is stiffened by its sewing: seams, bands and tabling hold the belly and the leeches in", () => {
    const shape = (seams: boolean): { belly: number; leech: number; foot: number } => {
      const s = new SailSim(square, seams);
      for (let i = 0; i < 6 * 60; i++) s.advance(1 / 60, 1, 1, 10, 0);
      const p = s.positions;
      return { belly: p[mid]!, leech: p[at(SAIL_ROWS / 2, 0)]!, foot: p[at(0, SAIL_COLS / 2)]! };
    };
    const sewn = shape(true);
    const plain = shape(false);
    expect(sewn.belly).toBeLessThan(plain.belly);
    expect(sewn.leech).toBeLessThan(plain.leech * 0.85);
    expect(sewn.foot).toBeLessThan(plain.foot * 0.85);
  });

  it("shakes when luffing and gathers to the yard when taken in", () => {
    const s = new SailSim(square);
    let lo = Infinity;
    let hi = -Infinity;
    const probe = at(SAIL_ROWS / 2, SAIL_COLS - 2);
    for (let i = 0; i < 8 * 60; i++) {
      s.advance(1 / 60, 1, 0.3, 9, 1);
      if (i > 240) {
        lo = Math.min(lo, s.positions[probe]!);
        hi = Math.max(hi, s.positions[probe]!);
      }
    }
    expect(hi - lo).toBeGreaterThan(0.15);
    const reefed = run(square, 4, 0.4, 1, 10).positions;
    let lowest = Infinity;
    for (let i = 1; i < reefed.length; i += 3) lowest = Math.min(lowest, reefed[i]!);
    // Taken in to 0.4, the foot is far above where it hangs at full sail.
    expect(lowest).toBeGreaterThan(square.foot + square.height * 0.45);
  });

  it("lies against the mast when taken aback instead of passing through it", () => {
    // The mast stands 0.42 m abaft the yard (at x = -0.42 in the sail's space); the wind blows the
    // canvas towards it.
    const mastX = -YARD_CLEAR;
    const inside = (sim: SailSim): number => {
      let count = 0;
      for (let i = 0; i < sim.positions.length; i += 3) if (Math.hypot(sim.positions[i]! - mastX, sim.positions[i + 2]!) < MAST_GIRTH - 1e-6) count++;
      return count;
    };
    const free = new SailSim(square);
    const held = new SailSim(square);
    for (let i = 0; i < 360; i++) {
      free.advance(1 / 60, 1, -1, 12, 0);
      held.advance(1 / 60, 1, -1, 12, 0, mastX);
    }
    // Without the collider the bunt blows through where the mast stands; with it nothing is inside.
    expect(inside(free)).toBeGreaterThan(0);
    expect(inside(held)).toBe(0);
    // The sail still fills aback on either side of the mast.
    let deepest = 0;
    for (let i = 0; i < held.positions.length; i += 3) deepest = Math.min(deepest, held.positions[i]!);
    expect(deepest).toBeLessThan(mastX - 0.3);
  });

  it("is cheap enough for a ship's suit of sails every frame", () => {
    const s = new SailSim(square);
    for (let i = 0; i < 120; i++) s.advance(1 / 60, 1, 1, 10, 0);
    // Cost of a step in units of a fixed piece of arithmetic timed on the same machine, each as the
    // best of ten batches: a budget in milliseconds measures the machine (a shared CI runner took
    // 0.83 ms where the development container took 0.15), a ratio measures the algorithm.
    const bestOf = (work: () => void): number => {
      let best = Infinity;
      for (let batch = 0; batch < 10; batch++) {
        const t0 = performance.now();
        work();
        best = Math.min(best, performance.now() - t0);
      }
      return best;
    };
    const scratch = new Float32Array(4096);
    const unit = bestOf(() => {
      for (let pass = 0; pass < 100; pass++) for (let i = 0; i < scratch.length; i++) scratch[i] = Math.sqrt(scratch[i]! * 0.5 + i);
    });
    const step = bestOf(() => {
      for (let i = 0; i < 60; i++) s.advance(1 / 60, 1, 1, 10, 0.2);
    }) / 60;
    // About 0.19 where it was written; the limit catches a step that has grown two and a half times.
    expect(step / unit).toBeLessThan(0.5);
  });

  it("stands for the fore-and-aft shapes too", () => {
    for (const shape of ["gaff", "jib"] as const) {
      const p = run({ shape, width: 9, height: 12, foot: 4 }, 5, 1, 1, 10).positions;
      expect(p.every(Number.isFinite), shape).toBe(true);
      let belly = 0;
      for (let i = 0; i < p.length; i += 3) belly = Math.max(belly, p[i]!);
      expect(belly, shape).toBeGreaterThan(0.2);
      expect(belly, shape).toBeLessThan(3);
    }
  });
  it("shot to rags, tears loose and hangs from its one remaining corner", () => {
    const s = new SailSim(square);
    for (let i = 0; i < 120; i++) s.advance(1 / 60, 1, 0.8, 8, 0);
    const kept = Array.from(s.positions.slice(at(SAIL_ROWS, 0), at(SAIL_ROWS, 0) + 3));
    const far0 = Array.from(s.positions.slice(at(SAIL_ROWS, SAIL_COLS), at(SAIL_ROWS, SAIL_COLS) + 3));
    s.tear();
    for (let i = 0; i < 6 * 60; i++) s.advance(1 / 60, 1, 0.8, 8, 0);
    const p = s.positions;
    expect(p.every(Number.isFinite)).toBe(true);
    expect(Array.from(p.slice(at(SAIL_ROWS, 0), at(SAIL_ROWS, 0) + 3))).toEqual(kept);
    const far = Array.from(p.slice(at(SAIL_ROWS, SAIL_COLS), at(SAIL_ROWS, SAIL_COLS) + 3));
    expect(Math.hypot(far[0]! - far0[0]!, far[1]! - far0[1]!, far[2]! - far0[2]!)).toBeGreaterThan(2);
  });
});
