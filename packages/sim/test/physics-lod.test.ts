import { describe, expect, it } from "vitest";
import { shipModel } from "../src/ship/ship-model";
import { Simulation } from "../src/simulation";

describe("physics level of detail", () => {
  it("keeps the volume with far fewer samples", () => {
    const m = shipModel("frigate");
    const v = (s: readonly { volume: number }[]) => s.reduce((a, x) => a + x.volume, 0);
    expect(m.samplesFar.length).toBeLessThan(m.samples.length / 2);
    expect(v(m.samplesFar)).toBeCloseTo(v(m.samples), 3);
  });

  it("floats a far ship at about the same draft as a near one", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 0.5 });
    sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const near = sim.spawnShip({ classId: "frigate", faction: "crown", x: 200, z: 0, heading: 0 });
    const far = sim.spawnShip({ classId: "frigate", faction: "crown", x: 2000, z: 0, heading: 0 });
    for (let i = 0; i < 60 * 40; i++) sim.step();
    expect(Math.abs(far.body!.pos.y - near.body!.pos.y)).toBeLessThan(0.35);
    expect(Number.isFinite(far.body!.pos.y)).toBe(true);
  });
});
