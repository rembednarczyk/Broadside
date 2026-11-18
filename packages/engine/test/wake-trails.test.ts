import { describe, expect, it } from "vitest";
import { RECORD_EVERY, TRAIL_POINTS, TRAIL_SHIPS, WakeTrails } from "../src/renderer/wake-trails";

const ship = (id: number, x: number, z: number, heading: number, d = 10) => ({ id, x, z, heading, speed: 5, length: 40, beam: 10, d });

describe("wake trails along the course sailed", () => {
  it("starts at the stern now and keeps the sterns of the last half minute, newest first", () => {
    const w = new WakeTrails();
    let out = w.update([ship(1, 0, 0, 0)], 0);
    // Heading 0 sails along +z: the stern lies 20 m behind the centre.
    for (let t = 0.1; t <= 40; t += 0.1) out = w.update([ship(1, Math.sin(t * 0.1) * 60, t * 5, t * 0.1)], t);
    expect(out.count).toBe(1);
    const n = out.meta[0]!;
    expect(n).toBeGreaterThanOrEqual(TRAIL_POINTS - 1);
    // No segment of zero length (a point recorded at the stern now is not repeated).
    for (let j = 1; j < n; j++) expect(Math.hypot(out.points[j * 4]! - out.points[(j - 1) * 4]!, out.points[j * 4 + 1]! - out.points[(j - 1) * 4 + 1]!)).toBeGreaterThan(0.5);
    // The first point is the stern now, of age 0; the ages grow down the trail, RECORD_EVERY apart.
    expect(out.points[2]).toBeCloseTo(0);
    for (let j = 1; j < n; j++) expect(out.points[j * 4 + 2]!).toBeGreaterThan(out.points[(j - 1) * 4 + 2]!);
    expect(out.points[(n - 1) * 4 + 2]!).toBeLessThan(RECORD_EVERY * TRAIL_POINTS + 0.2);
    // The trail bends with the course: its points do not lie on one straight line.
    const [x0, z0, x1, z1] = [out.points[0]!, out.points[1]!, out.points[(n - 1) * 4]!, out.points[(n - 1) * 4 + 1]!];
    const off = Math.max(...Array.from({ length: n }, (_, j) => Math.abs((out.points[j * 4]! - x0) * (z1 - z0) - (out.points[j * 4 + 1]! - z0) * (x1 - x0)) / Math.hypot(x1 - x0, z1 - z0)));
    expect(off).toBeGreaterThan(2);
    // The reach holds every point.
    for (let j = 0; j < n; j++) expect(Math.hypot(out.points[j * 4]! - out.meta[2]!, out.points[j * 4 + 1]! - out.meta[3]!)).toBeLessThan(out.reach[0]!);
  });

  it("gives trails to the nearest ships only, and forgets ships that are gone or jumped", () => {
    const w = new WakeTrails();
    const fleet = [0, 1, 2, 3, 4].map((i) => ship(i, i * 100, 0, 0, 100 - i * 10));
    const out = w.update(fleet, 0);
    expect(out.count).toBe(TRAIL_SHIPS);
    // Nearest first: ship 4 (d 60) leads.
    expect(out.points[0]).toBeCloseTo(400);
    w.update([ship(4, 400, 0, 0)], 2);
    const jumped = w.update([ship(4, 900, 0, 0)], 4);
    // A fresh trail: only the stern now.
    expect(jumped.meta[0]).toBe(1);
  });
});
