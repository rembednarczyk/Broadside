import { describe, expect, it } from "vitest";
import { vec3 } from "@broadside/core";
import { GameSession } from "../src/game-session";
import { STEP } from "@broadside/sim";
import { presentCombat, presentTarget } from "../src/presenters/combat-presenter";
import { cueFor, noticeFor } from "../src/presenters/event-presenter";

describe("combat presenter", () => {
  it("reports loaded batteries and stores of the player's ship", () => {
    const s = new GameSession({ seed: 3 });
    const me = s.sim.byId(s.playerId)!;
    const c = presentCombat(me)!;
    expect(c.port.count).toBe(me.ship!.model.guns.filter((g) => g.kind === "broadside" && g.side === "port").length);
    expect(c.port.ready).toBe(1);
    expect(c.ammo.map((a) => a.id)).toContain("chain");
    expect(c.hull).toBe(1);
  });

  it("finds no target when nothing hostile is in an arc, and one when it is", () => {
    const s = new GameSession({ seed: 3 });
    const me = s.sim.byId(s.playerId)!;
    expect(presentTarget(s.sim, me)).toBeNull();
    const pirate = s.sim.spawnShip({ classId: "sloop", faction: "pirates", x: me.body!.pos.x + 200, z: me.body!.pos.z, heading: 0 });
    const t = presentTarget(s.sim, me)!;
    expect(t.classId).toBe("sloop");
    expect(t.range).toBeGreaterThan(150);
    void pirate;
  });

  it("fires the starboard broadside with aim assist", () => {
    const s = new GameSession({ seed: 3 });
    const me = s.sim.byId(s.playerId)!;
    s.fire("broadside", "starboard");
    for (let i = 0; i < 60; i++) s.advance(STEP);
    const ready = presentCombat(me)!.starboard.ready;
    expect(ready).toBe(0);
  });
});

describe("event presenter", () => {
  it("maps events to cues and notices", () => {
    expect(cueFor({ type: "gunFired", ship: 1, at: vec3(0, 0, 0), dir: vec3(1, 0, 0), pounder: 12, ammo: "round" })?.kind).toBe("gun");
    expect(cueFor({ type: "weatherChanged", kind: "storm" })).toBeNull();
    expect(noticeFor({ type: "mastFell", ship: 1, mast: 0 }, 1)).toBe("notice.mastFell");
    expect(noticeFor({ type: "mastFell", ship: 2, mast: 0 }, 1)).toBeNull();
    expect(noticeFor({ type: "shipSunk", ship: 2, by: 1 }, 1)).toBe("notice.sunk");
  });
});
