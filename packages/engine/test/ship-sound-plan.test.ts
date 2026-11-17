import { describe, expect, it } from "vitest";
import { type ShipAudioState, bellStrokes, newShipSoundMemory, planShipSounds } from "../src/audio/ship-sound-plan";

const calm: ShipAudioState = { aboard: 1, speed: 3, wind: 6, load: 0.1, luff: 0, heel: 0.03, bow: 0, canvas: 2, turn: 0, ready: 10, water: 0, halfHour: 20 };
/** A fixed sequence instead of chance. */
const seq = (): (() => number) => {
  let i = 0;
  return () => ((i++ * 0.37) % 1);
};
const run = (states: readonly ShipAudioState[], dt = 0.1) => {
  const m = newShipSoundMemory();
  const rnd = seq();
  return states.map((s) => planShipSounds(s, m, dt, rnd));
};
const voices = (plans: ReturnType<typeof run>): string[] => plans.flatMap((p) => p.shots.map((s) => s.voice));

describe("ship sounds", () => {
  it("strikes the bell by the half hour of the watch, in pairs", () => {
    expect([0, 1, 2, 7, 8, 9, 16].map(bellStrokes)).toEqual([8, 1, 2, 7, 8, 1, 8]);
    const plans = run([calm, { ...calm, halfHour: 21 }]);
    const bells = plans[1]!.shots.filter((s) => s.voice === "bell");
    expect(bells).toHaveLength(5);
    // Two close strokes, a pause, two more, a pause, one.
    expect(bells.map((b) => b.delay)).toEqual([0, 0.55, 1.5, 2.05, 3]);
    expect(plans[0]!.shots.some((s) => s.voice === "bell")).toBe(false);
  });

  it("makes the ropes groan in a gust and more often under load", () => {
    const gust = run([calm, { ...calm, load: 0.9 }]);
    expect(gust[1]!.shots.some((s) => s.voice === "rope1" || s.voice === "rope2")).toBe(true);
    const count = (load: number): number => voices(run(Array.from({ length: 600 }, () => ({ ...calm, load })))).filter((v) => v === "rope1" || v === "rope2").length;
    expect(count(0.1)).toBe(0);
    expect(count(0.9)).toBeGreaterThan(count(0.4));
    expect(count(0.4)).toBeGreaterThan(2);
  });

  it("hears the crew haul when sail is set, and the canvas shake and crack", () => {
    const setting = run(Array.from({ length: 30 }, (_, i) => ({ ...calm, canvas: 2 + i * 0.02 })));
    expect(voices(setting)).toContain("run1");
    expect(voices(setting).some((v) => v === "rope3" || v === "rope2")).toBe(true);
    const tack = run([...Array.from({ length: 20 }, () => ({ ...calm, luff: 0.8, wind: 9 })), { ...calm, luff: 0, wind: 9 }]);
    expect(voices(tack.slice(0, 20))).toContain("flap");
    expect(tack[20]!.shots.some((s) => s.voice === "crack")).toBe(true);
    expect(voices(run(Array.from({ length: 30 }, () => calm)))).not.toContain("flap");
  });

  it("runs out a reloaded gun, slaps the bow into a sea and works the pump", () => {
    expect(voices(run([calm, { ...calm, ready: 11 }]))).toContain("rumble");
    expect(voices(run([calm, { ...calm, bow: -1.6 }]))).toContain("splash");
    expect(voices(run([calm, { ...calm, bow: -1.6, speed: 0.5 }]))).not.toContain("splash");
    expect(voices(run([{ ...calm, water: 4 }]))).toContain("winch2");
  });

  it("sets the beds from heel, speed and wind, and fades everything with the distance", () => {
    const [quiet] = run([calm]);
    const [hard] = run([{ ...calm, heel: 0.3, speed: 9, wind: 18, load: 1 }]);
    expect(hard!.deck).toBeGreaterThan(quiet!.deck * 3);
    expect(hard!.wash).toBeGreaterThan(quiet!.wash * 3);
    expect(quiet!.rig).toBe(0);
    expect(hard!.rig).toBeGreaterThan(0.1);
    // Strouhal: 18 m/s over a 12 mm line sings at 300 Hz.
    expect(hard!.rigTone).toBeCloseTo(300, 0);
    const [far] = run([{ ...calm, aboard: 0, heel: 0.3, load: 1, halfHour: 3 }]);
    expect(far!.deck).toBe(0);
    expect(far!.shots).toHaveLength(0);
  });
});
