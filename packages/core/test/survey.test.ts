import { describe, expect, it } from "vitest";
import { SURVEY, cellsInSight, generateArchipelago, surveyCentre, surveyIndex, surveySide } from "../src";

describe("survey cells", () => {
  const a = generateArchipelago(7);

  it("cut the sea's square into cells and find a point's cell", () => {
    const n = surveySide(a);
    expect(n).toBe(Math.ceil((2 * a.half) / SURVEY.cell));
    const c = surveyCentre(a, surveyIndex(a, 10, -20));
    expect(Math.abs(c.x - 10)).toBeLessThanOrEqual(SURVEY.cell / 2);
    expect(Math.abs(c.z + 20)).toBeLessThanOrEqual(SURVEY.cell / 2);
    expect(surveyIndex(a, a.half + 5, 0)).toBe(-1);
  });

  it("see the cells within the lookout's sight, in order", () => {
    const seen = cellsInSight(a, 0, 0, SURVEY.sight);
    expect(seen.length).toBeGreaterThan(60);
    expect([...seen].sort((p, q) => p - q)).toEqual(seen);
    for (const i of seen) {
      const c = surveyCentre(a, i);
      expect(Math.hypot(c.x, c.z)).toBeLessThanOrEqual(SURVEY.sight);
    }
    expect(seen).toContain(surveyIndex(a, 0, 0));
    expect(seen).not.toContain(surveyIndex(a, 2000, 0));
  });
});
