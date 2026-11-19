import { describe, expect, it } from "vitest";
import { MAST_FALL, MastFall } from "../src/renderer/mast-fall";

const run = (f: MastFall, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) f.step(1 / 60);
};

describe("a mast going by the board", () => {
  it("topples slowly at first, then fast, and lies out over the side in a few seconds", () => {
    const f = new MastFall(40);
    run(f, 1);
    expect(f.angle).toBeLessThan(0.6);
    run(f, 4);
    expect(f.angle).toBe(MAST_FALL.lie);
    expect(f.drop).toBe(0);
  });

  it("a shorter mast falls sooner", () => {
    const tall = new MastFall(45);
    const short = new MastFall(15);
    run(tall, 2);
    run(short, 2);
    expect(short.angle).toBeGreaterThan(tall.angle);
  });

  it("rests alongside, sinks, and is gone", () => {
    const f = new MastFall(30);
    run(f, 5 + MAST_FALL.rest + 1);
    expect(f.drop).toBeGreaterThan(0);
    expect(f.gone).toBe(false);
    run(f, MAST_FALL.sink);
    expect(f.gone).toBe(true);
  });
});
