import { describe, expect, it } from "vitest";
import type { DomainEvent } from "@broadside/core";
import { SalvoTally } from "../src/presenters/salvo-tally";

const at = { x: 0, y: 0, z: 0 };
const fired = (ship: number) => ({ type: "gunFired", ship, at, dir: at, pounder: 12, ammo: "round" }) as unknown as DomainEvent;
const hit = (ship: number, by: number) => ({ type: "hit", ship, by, at, part: "hull", damage: 5 }) as DomainEvent;

describe("salvo tally", () => {
  it("reports hits out of guns 2.5 s after the last gun", () => {
    const t = new SalvoTally();
    expect(t.update([fired(1), fired(1), fired(1), fired(1)], 1, 10)).toBeNull();
    expect(t.update([hit(2, 1), hit(2, 1), hit(1, 2)], 1, 11)).toBeNull();
    expect(t.update([], 1, 12.4)).toBeNull();
    expect(t.update([], 1, 12.6)).toBe("notice.hits|2|4");
    expect(t.update([], 1, 20)).toBeNull();
  });

  it("does not report a single gun, and caps hits at guns fired", () => {
    const t = new SalvoTally();
    t.update([fired(1)], 1, 0);
    expect(t.update([], 1, 3)).toBeNull();
    t.update([fired(1), fired(1), fired(1), hit(2, 1), hit(2, 1), hit(2, 1), hit(2, 1)], 1, 5);
    expect(t.update([], 1, 8)).toBe("notice.hits|3|3");
  });
});
