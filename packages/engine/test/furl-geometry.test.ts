import { describe, expect, it } from "vitest";
import { Matrix, Quaternion, Vector3 } from "../src/babylon";
import { GASKETS, furlGeometry, furlSection } from "../src/renderer/furl-geometry";

describe("furled sail on its yard", () => {
  it("gathers the bunt in the middle, thins to the arms and is pinched by the gaskets", () => {
    expect(furlSection(0).r).toBeCloseTo(0.5, 2);
    expect(furlSection(0.45).r).toBeLessThan(furlSection(0.2).r);
    for (const g of GASKETS) {
      expect(furlSection(g).r).toBeLessThan(furlSection(g - 0.06).r);
      expect(furlSection(g).r).toBeLessThan(furlSection(g + 0.06).r);
    }
    // The bight between the gaskets hangs lowest in the middle, and not at the ties.
    expect(furlSection(0).sag).toBeGreaterThan(0.2);
    expect(Math.abs(furlSection(GASKETS[1]).sag)).toBeLessThan(0.01);
  });

  it("is one closed roll with two gasket bands, inside the unit box of the yard's instance", () => {
    const g = furlGeometry();
    const n = g.positions.length / 3;
    expect(g.normals).toHaveLength(g.positions.length);
    expect(g.uvs).toHaveLength(n * 2);
    expect(Math.max(...g.indices)).toBeLessThan(n);
    for (let i = 0; i < n; i++) {
      expect(Math.abs(g.positions[i * 3 + 1]!)).toBeLessThanOrEqual(0.5);
      expect(Math.hypot(g.positions[i * 3]!, g.positions[i * 3 + 2]!)).toBeLessThan(1);
    }
    // UVs stay clear of the frayed foot of the canvas (v near 0).
    for (let i = 0; i < n; i++) expect(g.uvs[i * 2 + 1]!).toBeGreaterThan(0.2);
  });

  it("hangs down in the frame of a yard's instance (+z of the roll turned to world down)", () => {
    for (const angle of [0, 0.7, Math.PI / 2]) {
      const m = Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(angle, Math.PI / 2, 0), Vector3.Zero());
      expect(Vector3.TransformNormal(new Vector3(0, 0, 1), m).y).toBeCloseTo(-1, 6);
    }
  });
});
