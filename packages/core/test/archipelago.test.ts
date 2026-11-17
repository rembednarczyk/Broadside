import { describe, expect, it } from "vitest";
import { DEEP_SEA, fortSites, generateArchipelago, islandHeight, openWater, portSites, terrainHeight } from "../src/world/archipelago";
import { wreckSites } from "../src/world/wrecks";
import { FORT_CLASSES } from "../src/data/forts";

describe("archipelago", () => {
  const a = generateArchipelago(1797);

  it("is deterministic and spaced", () => {
    expect(generateArchipelago(1797)).toEqual(a);
    expect(a.islands.length).toBeGreaterThan(12);
    for (const p of a.islands) for (const q of a.islands) if (p !== q) expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(899);
  });

  it("keeps the start area open sea", () => {
    for (let x = -600; x <= 600; x += 100) for (let z = -600; z <= 600; z += 100) expect(terrainHeight(a, x, z)).toBe(DEEP_SEA);
  });

  it("rises above the sea at island centres and shoals near the shore", () => {
    for (const is of a.islands) {
      expect(islandHeight(is, is.x, is.z), `island ${is.id}`).toBeGreaterThan(0);
      expect(islandHeight(is, is.x + is.radius * 3 + is.shoal + 100, is.z)).toBe(DEEP_SEA);
    }
  });

  it("puts ports on non-cliff islands, at the water's edge", () => {
    const ports = portSites(a);
    expect(ports.length).toBeGreaterThan(2);
    for (const p of ports) {
      const is = a.islands[p.island]!;
      expect(is.kind).not.toBe("cliff");
      expect(terrainHeight(a, p.x, p.z)).toBeLessThan(5);
    }
  });
});

describe("open water", () => {
  it("moves a spawn point off the land", () => {
    const a = generateArchipelago(1797);
    const is = a.islands[0]!;
    const p = openWater(a, is.x, is.z);
    expect(terrainHeight(a, p.x, p.z)).toBe(DEEP_SEA);
  });
});

describe("forts", () => {
  it("guards every port and stands on land", () => {
    const a = generateArchipelago(1797);
    const forts = fortSites(a);
    const ports = portSites(a);
    for (let i = 0; i < ports.length; i++) expect(forts.some((f) => f.port === i)).toBe(true);
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
