import { describe, expect, it } from "vitest";
import { GameSession } from "../src/game-session";
import { presentChart } from "../src/presenters/chart-presenter";

describe("chart presenter", () => {
  it("charts every island, port and wreck, with the player's ship among the ships", () => {
    const s = new GameSession({ seed: 7 });
    const a = s.sim.env.archipelago!;
    const c = presentChart(s.sim, s.playerId)!;
    expect(c.half).toBe(a.half);
    expect(c.islands).toHaveLength(a.islands.length);
    expect(c.ports).toHaveLength(s.sim.ports.length);
    expect(c.islands.every((is) => is.coast.length > 8 && is.shoal.length === is.coast.length)).toBe(true);
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
});
