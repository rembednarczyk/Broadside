import { describe, expect, it } from "vitest";
import { DEEP_SEA, generateArchipelago, islandHeight, shoreDistance, spineLength, terrainHeight } from "../src/world/archipelago";
import { fortSites, openWater, portSites } from "../src/world/shores";
import { contourLoops, heightGrid } from "../src/world/contours";
import { wreckSites } from "../src/world/wrecks";
import { FORT_CLASSES } from "../src/data/forts";

describe("archipelago", () => {
  const a = generateArchipelago(1797);

  it("is deterministic and spaced", () => {
    expect(generateArchipelago(1797)).toEqual(a);
    const islands = a.islands.filter((is) => is.form === "island");
    expect(islands.length).toBeGreaterThan(10);
    for (const p of islands) for (const q of islands) if (p !== q) expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(899);
  });

  it("keeps the start area open sea", () => {
    for (const seed of [1797, 7, 42, 3]) {
      const w = generateArchipelago(seed);
      for (let x = -600; x <= 600; x += 100) for (let z = -600; z <= 600; z += 100) expect(terrainHeight(w, x, z), `seed ${seed}`).toBe(DEEP_SEA);
    }
  });

  it("rises above the sea along every spine and is deep sea beyond its reach", () => {
    for (const is of a.islands) {
      expect(islandHeight(is, is.x, is.z), `island ${is.id}`).toBeGreaterThan(0);
      // Out across the spine (perpendicular to it), past the land and the shoal.
      const len = spineLength(is);
      const nx = len > 0 ? -is.spine!.dz / len : 1;
      const nz = len > 0 ? is.spine!.dx / len : 0;
      const far = is.radius * 2 + is.shoal + 100;
      expect(islandHeight(is, is.x + nx * far, is.z + nz * far)).toBe(DEEP_SEA);
    }
  });

  it("has a mainland along one side of the sea, peninsulas from it and long islands", () => {
    for (const seed of [1797, 7, 42]) {
      const w = generateArchipelago(seed);
      const main = w.islands.filter((is) => is.form === "mainland");
      expect(main).toHaveLength(1);
      const arms = w.islands.filter((is) => is.form === "peninsula");
      expect(arms.length).toBeGreaterThanOrEqual(2);
      // Each peninsula's root is on the mainland, its tip out at sea beyond the mainland's coast.
      for (const p of arms) {
        const root = { x: p.x - p.spine!.dx, z: p.z - p.spine!.dz };
        const tip = { x: p.x + p.spine!.dx, z: p.z + p.spine!.dz };
        expect(terrainHeight(w, root.x, root.z)).toBeGreaterThan(0);
        expect(shoreDistance(main[0]!, tip.x, tip.z)).toBeGreaterThan(300);
      }
      expect(w.islands.some((is) => is.form === "island" && spineLength(is) > 0)).toBe(true);
      // Part of the sea's square is mainland: along the side, a stretch of land.
      let land = 0;
      for (let x = -w.half; x <= w.half; x += 200) for (let z = -w.half; z <= w.half; z += 200) if (terrainHeight(w, x, z) > 0) land++;
      expect(land / Math.pow(2 * w.half / 200 + 1, 2)).toBeGreaterThan(0.12);
    }
  });

  it("draws its coast as closed loops round the land", () => {
    const g = heightGrid(a, 80);
    const loops = contourLoops(g, 0);
    expect(loops.length).toBeGreaterThan(5);
    const inside = (p: { x: number; z: number }) => loops.reduce((n, loop) => {
      let c = false;
      for (let i = 0, k = loop.length - 1; i < loop.length; k = i++) {
        const u = loop[i]!;
        const v = loop[k]!;
        if (u.z > p.z !== v.z > p.z && p.x < ((v.x - u.x) * (p.z - u.z)) / (v.z - u.z) + u.x) c = !c;
      }
      return c ? n + 1 : n;
    }, 0) % 2 === 1;
    for (const is of a.islands.filter((i) => i.form === "island" && i.radius > 150)) expect(inside(is), `island ${is.id}`).toBe(true);
    expect(inside({ x: 0, z: 0 })).toBe(false);
  });

  it("puts ports on non-cliff islands, at the water's edge", () => {
    const ports = portSites(a);
    expect(ports.length).toBeGreaterThan(4);
    expect(new Set(ports.map((p) => p.name)).size).toBe(ports.length);
    expect(ports.filter((p) => a.islands[p.island]!.form === "mainland").length).toBeGreaterThanOrEqual(2);
    for (const p of ports) {
      const is = a.islands[p.island]!;
      expect(is.kind === "cliff" && is.form !== "mainland").toBe(false);
      expect(terrainHeight(a, p.x, p.z)).toBeLessThan(5);
    }
  });
});

describe("open water", () => {
  it("moves a spawn point off the land", () => {
    const a = generateArchipelago(1797);
    const is = a.islands.find((i) => i.form === "island")!;
    const p = openWater(a, is.x, is.z);
    expect(terrainHeight(a, p.x, p.z)).toBe(DEEP_SEA);
  });
});

describe("forts", () => {
  it("guards every port and stands on land", () => {
    const a = generateArchipelago(1797);
    const forts = fortSites(a);
    const ports = portSites(a);
    for (let i = 0; i < ports.length; i++) expect(forts.some((f) => f.port === i), `port ${i}`).toBe(true);
    for (const f of forts) {
      expect(f.y).toBeGreaterThanOrEqual(2);
      expect(FORT_CLASSES[f.classId].guns).toBeGreaterThan(0);
    }
    expect(fortSites(a)).toEqual(forts);
  });
});

describe("wrecks", () => {
  it("lie on the shoals, clear of the ports, the same for a seed", () => {
    let total = 0;
    for (const seed of [7, 1797, 42]) {
      const a = generateArchipelago(seed);
      const wrecks = wreckSites(a);
      total += wrecks.length;
      for (const w of wrecks) {
        expect(w.seabed).toBeLessThanOrEqual(-0.9);
        expect(w.seabed).toBeGreaterThan(-2.1);
        expect(terrainHeight(a, w.x, w.z)).toBe(w.seabed);
        for (const p of portSites(a)) expect(Math.hypot(p.x - w.x, p.z - w.z)).toBeGreaterThanOrEqual(260);
      }
      expect(wreckSites(a)).toEqual(wrecks);
    }
    expect(total).toBeGreaterThan(3);
  });
});
