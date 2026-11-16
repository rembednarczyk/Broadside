import { describe, expect, it } from "vitest";
import { CELLS, cellInfluence, driftCells } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { windAt } from "../src/environment/environment";
import { restore, snapshot } from "../src/save/snapshot";

const cell = () => ({ x: 0, z: 0, radius: 400, strength: 1, age: CELLS.ramp, life: 600 });

describe("storm cells", () => {
  it("are strongest at the core and fade with distance and age", () => {
    expect(cellInfluence([cell()], 0, 0)).toBeCloseTo(1);
    expect(cellInfluence([cell()], 400, 0)).toBeLessThan(0.2);
    expect(cellInfluence([{ ...cell(), age: 0 }], 0, 0)).toBe(0);
  });

  it("drift down the wind and die", () => {
    const moved = driftCells([cell()], Math.PI / 2, 10, 10);
    expect(moved[0]!.x).toBeCloseTo(10 * 10 * CELLS.drift);
    expect(driftCells([{ ...cell(), age: 599.9 }], 0, 10, 1)).toHaveLength(0);
  });

  it("blow harder over a ship inside", () => {
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 8 });
    sim.env.cells.push(cell());
    const inside = windAt(sim.env, 10, 0, 0);
    const outside = windAt(sim.env, 10, 3000, 0);
    expect(Math.hypot(inside.x, inside.z)).toBeCloseTo(8 * (1 + CELLS.gust));
    expect(Math.hypot(outside.x, outside.z)).toBeCloseTo(8);
  });

  it("breed in squally weather, upwind of the ships, and are saved", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 8, weather: "squally" });
    sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    for (let i = 0; i < 60 * 60 * 6 && sim.env.cells.length === 0; i++) sim.step();
    expect(sim.env.cells.length).toBeGreaterThan(0);
    const back = restore(JSON.parse(JSON.stringify(snapshot(sim, { seed: 4, windDirection: 0, windSpeed: 8, weather: "squally" }))), null);
    expect(back.env.cells).toEqual(sim.env.cells);
  });
});
