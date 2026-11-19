import { describe, expect, it } from "vitest";
import { GameSession } from "../src/game-session";
import { presentChart } from "../src/presenters/chart-presenter";

describe("chart presenter", () => {
  it("charts the coasts, every port and wreck, with the player's ship among the ships", () => {
    const s = new GameSession({ seed: 7 });
    const a = s.sim.env.archipelago!;
    const c = presentChart(s.sim, s.playerId)!;
    expect(c.half).toBe(a.half);
    expect(c.land.length).toBeGreaterThan(a.islands.length / 2);
    expect(c.ports).toHaveLength(s.sim.ports.length);
    expect(c.shoals.length).toBeGreaterThan(0);
    const me = c.ships.filter((v) => v.kind === "player");
    expect(me).toHaveLength(1);
    const body = s.sim.byId(s.playerId)!.body!;
    expect(me[0]!.x).toBeCloseTo(body.pos.x);
    expect(me[0]!.z).toBeCloseTo(body.pos.z);
    expect(c.wrecks.every((w) => !w.salvaged)).toBe(true);
  });

  it("shows the crew's course to a point set on it", () => {
    const s = new GameSession({ seed: 7 });
    const body = s.sim.byId(s.playerId)!.body!;
    s.helm.navigate([{ x: body.pos.x + 300, z: body.pos.z + 300 }], false);
    s.advance(0.1);
    const c = presentChart(s.sim, s.playerId)!;
    expect(c.route.length).toBeGreaterThanOrEqual(2);
    expect(c.goal).not.toBeNull();
  });

  it("leaves the unsurveyed sea blank and shows only the ships in sight", () => {
    const s = new GameSession({ seed: 7 });
    s.advance(2);
    const c = presentChart(s.sim, s.playerId)!;
    const a = s.sim.env.archipelago!;
    const fogArea = c.fog.reduce((sum, f) => sum + f.w * f.h, 0);
    // Most of the sea is still blank at the start, but not the water round the ship.
    expect(fogArea / Math.pow(2 * a.half, 2)).toBeGreaterThan(0.8);
    const me = s.sim.byId(s.playerId)!.body!.pos;
    expect(c.fog.some((f) => me.x >= f.x && me.x < f.x + f.w && me.z >= f.z && me.z < f.z + f.h)).toBe(false);
    for (const v of c.ships) expect(Math.hypot(v.x - me.x, v.z - me.z)).toBeLessThanOrEqual(1200);
    // A fresh game with every cell surveyed has no fog.
    s.sim.survey.seen = Array.from({ length: Math.pow(Math.ceil((2 * a.half) / 250), 2) }, (_, i) => i);
    expect(presentChart(s.sim, s.playerId)!.fog).toEqual([]);
  });
});
