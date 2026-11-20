import { describe, expect, it } from "vitest";
import { VertexData } from "../src/babylon";
import { CANOPY, PALM, broadleafGeometry, frondRib, palmGeometry, type TreeGeometry } from "../src/renderer/tree-geometry";

const normalsOf = (g: TreeGeometry): number[] => {
  const n: number[] = [];
  VertexData.ComputeNormals(g.positions, g.indices, n);
  return n;
};

const bounds = (g: TreeGeometry) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.positions.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3]!, g.positions[i]!);
    hi[i % 3] = Math.max(hi[i % 3]!, g.positions[i]!);
  }
  return { lo, hi };
};

describe("palm", () => {
  const g = palmGeometry();

  it("is a valid mesh with a colour per vertex", () => {
    expect(g.positions.length % 3).toBe(0);
    expect(g.colors.length / 4).toBe(g.positions.length / 3);
    for (const i of g.indices) expect(i).toBeLessThan(g.positions.length / 3);
  });

  it("stands on the ground, its crown at height 1 and its fronds drooping below it", () => {
    const { lo, hi } = bounds(g);
    expect(lo[1]).toBe(0);
    expect(hi[1]).toBeLessThan(1.1);
    // The fronds' lowest point: the droop below the crown, with the fold of the edges.
    const fronds = g.positions.filter((_, i) => i % 3 === 1 && i >= 8 * 6 * 3);
    expect(Math.min(...fronds)).toBeGreaterThan(1 - PALM.droop - 0.05);
    expect(Math.min(...fronds)).toBeLessThan(1 - PALM.droop * 0.5);
    // The fronds arch: up near the crown, down at the tip.
    expect(frondRib(0.25, 0, [0, 1, 0])[1]).toBeGreaterThan(1);
    expect(frondRib(1, 0, [0, 1, 0])[1]).toBeLessThan(1);
  });

  it("spreads its crown all round", () => {
    const { lo, hi } = bounds(g);
    expect(hi[0]! - lo[0]!).toBeGreaterThan(PALM.frondLength * 1.5);
    expect(hi[2]! - lo[2]!).toBeGreaterThan(PALM.frondLength * 1.5);
  });

  it("faces the trunk outwards and the fronds upwards", () => {
    const n = normalsOf(g);
    // The trunk's first ring (6 vertices at the ground): normals point away from the axis.
    for (let v = 0; v < 6; v++) {
      const radial = g.positions[v * 3]! * n[v * 3]! + g.positions[v * 3 + 2]! * n[v * 3 + 2]!;
      expect(radial).toBeGreaterThan(0);
    }
    // The fronds' ribs near the crown (the middle vertex of each cross-section): normals up.
    const trunk = 8 * 6;
    let up = 0;
    for (let f = 0; f < PALM.fronds; f++) up += n[(trunk + f * (PALM.segments + 1) * 3 + 4) * 3 + 1]!;
    expect(up / PALM.fronds).toBeGreaterThan(0.3);
  });
});

describe("broadleaf", () => {
  const g = broadleafGeometry();

  it("is a valid mesh with a colour per vertex, its crown over the trunk", () => {
    expect(g.colors.length / 4).toBe(g.positions.length / 3);
    for (const i of g.indices) expect(i).toBeLessThan(g.positions.length / 3);
    const { lo, hi } = bounds(g);
    expect(lo[1]).toBe(0);
    expect(hi[1]).toBeGreaterThan(1);
    expect(hi[1]).toBeLessThan(1.25);
    expect(Math.max(...CANOPY.map((c) => Math.abs(c[0]) + c[3]))).toBeLessThan(0.6);
  });

  it("faces its crown outwards", () => {
    const n = normalsOf(g);
    // The top vertex of the first lump points up.
    const top = 3 * 5;
    expect(n[top * 3 + 1]!).toBeGreaterThan(0.5);
  });

  it("stays light: a few hundred triangles at most for thousands of instances", () => {
    expect(g.indices.length / 3).toBeLessThan(500);
    expect(palmGeometry().indices.length / 3).toBeLessThan(400);
  });
});
