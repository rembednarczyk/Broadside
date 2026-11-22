import { describe, expect, it } from "vitest";
import { FORT_CLASSES, type FortSite, darkness, flight, fortLayout, fortToWorld, fortTop, sightShare, speedFor, strikeFort, dragFactor, wallNormal, wrapAngle } from "../src/index";

const site = (classId: FortSite["classId"], facing = 0): FortSite => ({ x: 100, z: -50, y: 5, classId, faction: "crown", port: null, facing });
const p = (x: number, y: number, z: number) => ({ x, y, z });

describe("fort layout (one source for the walls drawn and struck)", () => {
  it("lays each wall gun square to its wall, facing out", () => {
    for (const def of Object.values(FORT_CLASSES)) {
      const l = fortLayout(def);
      expect(l.guns).toHaveLength(def.guns);
      expect(l.mortars).toHaveLength(def.mortars);
      for (const g of l.guns.filter((x) => !x.tower)) {
        const w = l.walls[g.on]!;
        const along = Math.atan2(w.x1 - w.x0, w.z1 - w.z0);
        expect(Math.abs(Math.abs(wrapAngle(g.angle - along)) - Math.PI / 2)).toBeLessThan(1e-9);
        // Out of the fort: the normal points away from the centre.
        expect(Math.sin(g.angle) * g.x + Math.cos(g.angle) * g.z).toBeGreaterThan(0);
        expect(wallNormal(w)).toBe(g.angle);
      }
    }
  });

  it("strikes the donjon of a citadel up to its top, and nothing above it", () => {
    const def = FORT_CLASSES.citadel;
    const s = site("citadel");
    const top = fortTop(def);
    expect(top).toBeGreaterThan(def.height * 2);
    // A ball flying level through the centre just under the donjon's top.
    const hi = strikeFort(def, s, p(s.x - 30, s.y + top - 1, s.z), p(s.x + 30, s.y + top - 1, s.z));
    expect(hi?.kind).toBe("tower");
    expect(strikeFort(def, s, p(s.x - 30, s.y + top + 3, s.z), p(s.x + 30, s.y + top + 3, s.z))).toBeNull();
  });

  it("lets a ball pass the air in front of a battery's rampart", () => {
    const def = FORT_CLASSES.battery;
    const s = site("battery", Math.PI / 2);
    // The rampart lies 0.6 radius out on the facing (+x here); 5 m in front of it is open air.
    const front = fortToWorld(s, 0, 3, def.radius * 0.6 + 5);
    expect(strikeFort(def, s, p(front.x, front.y, front.z - 3), p(front.x, front.y, front.z + 3))).toBeNull();
    const wall = fortToWorld(s, 0, 3, def.radius * 0.6);
    const hit = strikeFort(def, s, p(wall.x + 10, wall.y, wall.z), p(wall.x - 10, wall.y, wall.z));
    expect(hit?.kind).toBe("wall");
    expect(hit!.t).toBeGreaterThan(0.3);
    expect(hit!.t).toBeLessThan(0.5);
  });
});

describe("mortar charges and the time of flight", () => {
  it("finds the charge that lands a shell at a range, with drag and a height", () => {
    const k = dragFactor(59);
    for (const [range, h] of [[300, 0], [600, 30], [750, -5]] as const) {
      const v = speedFor(range, Math.PI / 4, h, k, 95);
      expect(Math.abs(flight(v, Math.PI / 4, h, k).range - range)).toBeLessThan(2);
    }
    // A shell lobbed at 45 deg to 600 m flies about 10 s.
    const t = flight(speedFor(600, Math.PI / 4, 0, k, 95), Math.PI / 4, 0, k).time;
    expect(t).toBeGreaterThan(9);
    expect(t).toBeLessThan(13);
  });
});

describe("the day's darkness and a lookout's sight", () => {
  it("is dark at night, light by day, half way at dusk", () => {
    expect(darkness(12)).toBe(0);
    expect(darkness(23)).toBe(1);
    expect(darkness(19)).toBeCloseTo(0.5);
    expect(darkness(6)).toBeCloseTo(0.5);
    expect(sightShare(0, 0)).toBe(1);
    expect(sightShare(1, 1)).toBeCloseTo(0.3 * 0.6);
  });
});
