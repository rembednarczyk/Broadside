import { describe, expect, it } from "vitest";
import { yawOf } from "@broadside/core";
import { STEP } from "@broadside/sim";
import { GameSession } from "../src/game-session";
import { presentSailing } from "../src/presenters/sailing-presenter";

describe("game session", () => {
  it("steps the simulation in whole fixed steps", () => {
    const s = new GameSession({ seed: 1 });
    expect(s.advance(STEP * 2.5)).toBe(2);
    expect(s.advance(STEP * 0.6)).toBe(1);
    // A long stall is capped.
    expect(s.advance(5)).toBeLessThanOrEqual(8);
  });

  it("turns the ship while the helm is held and holds the new course on release", () => {
    const s = new GameSession({ seed: 1 });
    s.advance(2);
    const before = yawOf(s.sim.byId(s.playerId)!.body!.rot);
    s.steer(1);
    for (let i = 0; i < 60 * 4; i++) s.advance(STEP);
    s.steer(0);
    for (let i = 0; i < 60 * 15; i++) s.advance(STEP);
    const after = yawOf(s.sim.byId(s.playerId)!.body!.rot);
    expect(after - before).toBeGreaterThan(0.35);
    const hud = presentSailing(s.sim, s.playerId)!;
    expect(Math.abs(hud.course! - after)).toBeLessThan(0.15);
  });

  it("sets sail and reports it to the HUD", () => {
    const s = new GameSession({ seed: 1 });
    s.setSails(1);
    s.advance(STEP * 2);
    expect(presentSailing(s.sim, s.playerId)!.sailTargets.every((l) => l === 1)).toBe(true);
  });
});
