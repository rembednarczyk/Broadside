import { describe, expect, it } from "vitest";
import { SAIL_COLS, SAIL_ROWS, type SailOutline } from "../src/renderer/sail-geometry";
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

  it("is cheap enough for a ship's suit of sails every frame", () => {
    const s = new SailSim(square);
    for (let i = 0; i < 120; i++) s.advance(1 / 60, 1, 1, 10, 0);
    // Ten seconds of one sail, timed as the best of ten batches: the minimum is the measure that
    // the load of the machine does not move (the mean failed on a shared CI runner busy with the
    // other test files, at 0.86 ms; the best batch here is about 0.15 ms). Under a millisecond a frame leaves room
    // for a dozen sails.
    let best = Infinity;
    for (let batch = 0; batch < 10; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) s.advance(1 / 60, 1, 1, 10, 0.2);
      best = Math.min(best, (performance.now() - t0) / 60);
    }
    expect(best).toBeLessThan(0.8);
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
});
