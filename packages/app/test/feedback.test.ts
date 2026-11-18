import { describe, expect, it } from "vitest";
import { type DomainEvent } from "@broadside/core";
import { GameSession } from "../src/game-session";
import { pulseFor, strongest } from "../src/feedback/haptics";
import { presentWind } from "../src/presenters/course-presenter";

const at = { x: 0, y: 0, z: 0 };

describe("felt and seen feedback of simple steering", () => {
  it("vibrates for the own ship only, the strongest pulse of a frame", () => {
    const fired = { type: "gunFired", ship: 1, at, dir: at, pounder: 12, ammo: "round" } as DomainEvent;
    const hit = { type: "hit", ship: 1, by: 2, at, part: "hull", damage: 50 } as DomainEvent;
    expect(pulseFor(fired, 1)).toBe("light");
    expect(pulseFor(fired, 2)).toBeNull();
    expect(pulseFor(hit, 1)).toBe("heavy");
    expect(strongest([fired, hit, fired], 1)).toBe("heavy");
    expect(strongest([], 1)).toBeNull();
  });

  it("shows the no-go zone while drawing, and the laylines when the goal lies to windward", () => {
    const s = new GameSession({ seed: 1 });
    s.advance(0.5);
    const me = s.sim.byId(s.playerId)!.body!.pos;
    const w = s.sim.env.windDirection;
    expect(presentWind(s.sim, s.playerId, false, null)).toBeNull();
    expect(presentWind(s.sim, s.playerId, true, null)?.goal).toBeNull();
    const upwind = { x: me.x - Math.sin(w) * 400, z: me.z - Math.cos(w) * 400 };
    expect(presentWind(s.sim, s.playerId, false, upwind)?.goal).toEqual(upwind);
    const downwind = { x: me.x + Math.sin(w) * 400, z: me.z + Math.cos(w) * 400 };
    expect(presentWind(s.sim, s.playerId, false, downwind)).toBeNull();
  });
});
