import { describe, expect, it } from "vitest";
import { wrapAngle, yawOf } from "@broadside/core";
import { GameSession } from "../src/game-session";

describe("classic helm", () => {
  it("steadies on her head when the button is let go (no swing on of 20-30 degrees)", () => {
    const s = new GameSession({ seed: 7 });
    const me = s.sim.byId(s.playerId)!;
    s.advance(5);
    s.helm.steer(-1);
    s.advance(4);
    s.helm.steer(0);
    const atRelease = yawOf(me.body!.rot);
    s.advance(15);
    expect(Math.abs(wrapAngle(yawOf(me.body!.rot) - atRelease))).toBeLessThan(0.17);
  });
});
