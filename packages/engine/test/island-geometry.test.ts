import { describe, expect, it } from "vitest";
import { type Island, generateArchipelago, terrainHeight } from "@broadside/core";
import { VertexData } from "../src/babylon";
import { CHUNK, chunkCorners, chunkGeometry, chunkTrees, cliffProfile, drawnLand } from "../src/renderer/island-geometry";

const island = (kind: Island["kind"]): Island => ({ id: 1, x: 0, z: 0, radius: 300, height: 60, kind, seed: 3, shoal: 80 });

describe("cliff profile", () => {
  it("keeps the waterline, the beach and the summit where the simulation has them", () => {
    const is = island("cliff");
    expect(cliffProfile(is, 0)).toBe(0);
    expect(cliffProfile(is, -5)).toBe(-5);
    expect(cliffProfile(is, 0.5)).toBe(0.5);
    expect(cliffProfile(is, 60)).toBeCloseTo(60);
  });

  it("rises steeply above the beach and flattens towards the top, more on cliff islands", () => {
    const cliff = island("cliff");
    const hill = island("jungle");
    let last = 0.8;
    for (let y = 1; y <= 60; y += 1) {
      const v = cliffProfile(cliff, y);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(cliffProfile(cliff, 5)).toBeGreaterThan(cliffProfile(hill, 5));
    expect(cliffProfile(hill, 5)).toBeGreaterThan(5);
  });
});

describe("land chunks", () => {
  const a = generateArchipelago(7);
  const is = a.islands.find((i) => i.form === "island" && i.radius > 150)!;
  const corner = { x: Math.floor(is.x / CHUNK) * CHUNK, z: Math.floor(is.z / CHUNK) * CHUNK };

  it("draws the land where the simulation has it, the waterline in place", () => {
    const g = chunkGeometry(a, corner.x, corner.z, 25)!;
    expect(g).not.toBeNull();
    expect(g.colors.length / 4).toBe(g.positions.length / 3);
    for (const i of g.indices) expect(i).toBeLessThan(g.positions.length / 3);
    // Each grid vertex (not the skirts) above water where the terrain is, below where it is not.
    for (let v = 0; v < 26 * 26; v++) {
      const [x, y, z] = [g.positions[v * 3]!, g.positions[v * 3 + 1]!, g.positions[v * 3 + 2]!];
      expect(y > 0.01, `${x},${z}`).toBe(terrainHeight(a, x, z) > 0.01);
    }
  });

  it("faces its land upwards", () => {
    const g = chunkGeometry(a, corner.x, corner.z, 25)!;
    const normals: number[] = [];
    VertexData.ComputeNormals(g.positions, g.indices, normals);
    let up = 0;
    for (let v = 0; v < 26 * 26; v++) up += normals[v * 3 + 1]!;
    expect(up / (26 * 26)).toBeGreaterThan(0.5);
  });

  it("leaves open sea out and covers the mainland beyond the sea's edge", () => {
    expect(chunkGeometry(a, -250, -250, 10)).toBeNull();
    const corners = chunkCorners(a, 1000);
    const main = a.islands.find((i) => i.form === "mainland")!;
    expect(corners.some((c) => drawnLand(a, c.x + CHUNK / 2, c.z + CHUNK / 2).island === main)).toBe(true);
  });

  it("grows trees on land only, the same for a seed, palms by the shore", () => {
    const trees = chunkTrees(a, corner.x, corner.z, 400);
    expect(trees.length).toBeGreaterThan(10);
    expect(chunkTrees(a, corner.x, corner.z, 400)).toEqual(trees);
    for (const t of trees) expect(t.y).toBeGreaterThanOrEqual(2.5);
    for (const t of trees.filter((t) => t.palm)) expect(t.y < 14 || a.islands.some((i) => i.kind === "beach")).toBe(true);
  });
});
