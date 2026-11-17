import { describe, expect, it } from "vitest";
import { GameSession } from "../src/game-session";
import { presentAmbience } from "../src/presenters/ambience-presenter";

describe("ambience", () => {
  it("hears the shore near an island and not out at sea", () => {
    const s = new GameSession({ seed: 1 });
    const is = s.sim.env.archipelago!.islands[0]!;
    expect(presentAmbience(s.sim, is.x + is.radius + 50, is.z, s.playerId).land).toBeGreaterThan(0.8);
    expect(presentAmbience(s.sim, is.x + 20000, is.z + 20000, s.playerId).land).toBe(0);
  });

  it("follows the weather: a storm is stormy and wet, a breeze is not", () => {
    const storm = new GameSession({ seed: 2, weather: "storm" });
    const a = presentAmbience(storm.sim, 0, 0, storm.playerId);
    expect(a.storm).toBe(1);
    const calm = new GameSession({ seed: 2, weather: "breeze" });
    const b = presentAmbience(calm.sim, 0, 0, calm.playerId);
    expect(b.storm).toBe(0);
    expect(b.windSpeed).toBeLessThan(a.windSpeed);
  });
});
