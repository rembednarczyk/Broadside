import { describe, expect, it } from "vitest";
import { type DomainEvent, yawOf } from "@broadside/core";
import { GameSession } from "../src/game-session";

const abeam = (s: GameSession) => {
  const me = s.sim.byId(s.playerId)!;
  const h = yawOf(me.body!.rot);
  // 150 m on the starboard beam (heading measured with x = sin, z = cos; starboard is +90 degrees).
  return s.sim.spawnShip({ classId: "schooner", faction: "pirates", x: me.body!.pos.x + Math.sin(h + Math.PI / 2) * 150, z: me.body!.pos.z + Math.cos(h + Math.PI / 2) * 150, heading: h });
};

describe("gun captains (simple steering)", () => {
  it("fire as the guns bear on an enemy close aboard", () => {
    const s = new GameSession({ seed: 7 });
    abeam(s);
    const events: DomainEvent[] = [];
    for (let i = 0; i < 4 * 30; i++) {
      s.advance(1 / 30, true);
      events.push(...s.sim.drainEvents());
    }
    expect(events.some((e) => e.type === "gunFired" && e.ship === s.playerId)).toBe(true);
  });

  it("hold their fire without the standing order", () => {
    const s = new GameSession({ seed: 7 });
    abeam(s);
    const events: DomainEvent[] = [];
    for (let i = 0; i < 4 * 30; i++) {
      s.advance(1 / 30);
      events.push(...s.sim.drainEvents());
    }
    expect(events.some((e) => e.type === "gunFired" && e.ship === s.playerId)).toBe(false);
  });
});
