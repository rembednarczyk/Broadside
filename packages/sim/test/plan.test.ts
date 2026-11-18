import { describe, expect, it } from "vitest";
import { clearLeg, findWay, planRoute } from "../src/ai/pilot/plan";

// An island 300 m across in the middle of the sea, and a long reef to the north of it.
const bed = (x: number, z: number): number => (Math.hypot(x, z) < 150 ? 5 : x > -40 && x < 40 && z > 150 && z < 900 ? 1 : -30);
const KEEL = -6;

describe("a way round the islands", () => {
  it("goes round land that lies across the leg, in a few straight legs through open water", () => {
    const a = { x: -600, z: 0 };
    const b = { x: 600, z: 0 };
    expect(clearLeg(bed, a, b, KEEL)).toBe(false);
    const way = findWay(bed, a, b, KEEL)!;
    expect(way[way.length - 1]).toEqual(b);
    expect(way.length).toBeLessThanOrEqual(4);
    let at = a;
    for (const p of way) {
      expect(clearLeg(bed, at, p, KEEL)).toBe(true);
      at = p;
    }
  });

  it("keeps clear legs as given and plans only those over land; the same every time", () => {
    const from = { x: -600, z: -400 };
    const route = [{ x: -600, z: 0 }, { x: 600, z: 0 }];
    const planned = planRoute(bed, from, route, KEEL);
    expect(planned[0]).toEqual(route[0]);
    expect(planned.length).toBeGreaterThan(route.length);
    expect(planRoute(bed, from, route, KEEL)).toEqual(planned);
    expect(planRoute(null, from, route, KEEL)).toEqual(route);
  });
});

describe("AI captains round the islands", () => {
  it("steer for a turning point of a way round the land, not straight at a waypoint behind it", async () => {
    const { Simulation } = await import("../src/simulation");
    const { createCaptain } = await import("../src/ai/captain-state");
    const { wayPoint } = await import("../src/ai/waypoints");
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 8 });
    const me = sim.spawnShip({ classId: "brig", faction: "crown", x: -600, z: 0, heading: Math.PI / 2 });
    const c = createCaptain(600, 0, 200, "trade");
    const p = wayPoint(me, c, bed);
    expect(p).not.toEqual({ x: 600, z: 0 });
    expect(clearLeg(bed, { x: -600, z: 0 }, p, KEEL)).toBe(true);
    // Planned once for the waypoint, kept until it changes.
    const way = c.way;
    wayPoint(me, c, bed);
    expect(c.way).toBe(way);
    // In open water the way is the waypoint.
    const open = createCaptain(600, -900, 200);
    expect(wayPoint(me, open, null)).toEqual({ x: 600, z: -900 });
  });
});
