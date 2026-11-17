import { describe, expect, it } from "vitest";
import { SideProfile } from "../src/renderer/side-profile";

const fit = { kx: 0.5, ky: 0.5, draft: 2, length: 40 };
/** A waist at height 8 between two castles at 12, with a notch and a spike in the waist. */
const top = [12, 12, 12, 12, 8, 8, 5, 8, 8, 20, 8, 8, 12, 12, 12, 12];
const half = top.map((_, k) => (k === 6 ? 1 : 6));

describe("side profile of a modelled hull", () => {
  const p = new SideProfile({ half, top }, fit);

  it("reads breadth and bulwark height in hull space through a median", () => {
    // 16 stations over 20 m: z = -10 .. 10; the notch and the spike do not show.
    expect(p.zOf(0)).toBeCloseTo(-9.375);
    expect(p.halfAt(-2)).toBeCloseTo(3);
    expect(p.topAt(-2)).toBeCloseTo(2);
    expect(p.topAt(1.5)).toBeCloseTo(2);
    expect(p.topAt(-9)).toBeCloseTo(4);
  });

  it("runs the rail along the top, broken at the castles, with posts where the model falls short", () => {
    const { runs, posts } = p.railRuns(1);
    expect(runs).toHaveLength(3);
    expect(runs[1]!.every((q) => Math.abs(q[1] - 2) < 1e-9 && q[0] > 0)).toBe(true);
    // A post at the notch (station 6), from the low bulwark up to the rail; none where the model
    // already reaches the rail.
    const notch = posts.find((q) => Math.abs(q.z - p.zOf(6)) < 1e-9)!;
    expect(notch.to).toBeCloseTo(2);
    expect(notch.from).toBeGreaterThanOrEqual(0.5);
    expect(posts.some((q) => Math.abs(q.z - p.zOf(5)) < 1e-9)).toBe(false);
    expect(p.railRuns(-1).runs[0]![0]![0]).toBeLessThan(0);
  });
});
