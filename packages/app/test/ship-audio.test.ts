import { describe, expect, it } from "vitest";
import { GameSession } from "../src/game-session";
import { presentShipAudio } from "../src/presenters/ship-audio-presenter";
import { cueFor } from "../src/presenters/event-presenter";

describe("ship audio presenter", () => {
  it("reads speed, wind, load and the watch from the player's ship", () => {
    const session = new GameSession({ seed: 7, weather: "fresh" });
    session.setSails(3);
    session.advance(40);
    const a = presentShipAudio(session.sim, session.playerId, 40, 12.6)!;
    expect(a.aboard).toBeGreaterThan(0.9);
    expect(a.speed).toBeGreaterThan(1);
    expect(a.wind).toBeGreaterThan(3);
    expect(a.load).toBeGreaterThan(0);
    expect(a.canvas).toBeGreaterThan(1);
    expect(a.ready).toBeGreaterThan(0);
    expect(a.halfHour).toBe(25);
    expect(Number.isFinite(a.bow)).toBe(true);
    expect(a.luff).toBeGreaterThanOrEqual(0);
    expect(a.luff).toBeLessThanOrEqual(1);
    // Far above the ship her own sounds fade, but never quite go.
    expect(presentShipAudio(session.sim, session.playerId, 400, 12.6)!.aboard).toBe(0.2);
    expect(presentShipAudio(session.sim, -5, 40, 12)).toBeNull();
  });

  it("mans the capstan only for the player's own grounding", () => {
    const at = { x: 0, y: 0, z: 0 };
    expect(cueFor({ type: "grounded", ship: 3, at, speed: 2 }, 3)).toEqual({ kind: "capstan" });
    expect(cueFor({ type: "grounded", ship: 4, at, speed: 2 }, 3)).toBeNull();
  });
});
