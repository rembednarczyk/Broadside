import { describe, expect, it } from "vitest";
import { WEATHER, createWeather, nextKind, stepWeather, windNow, type WeatherKind } from "../src/weather/weather";
import { createRng } from "../src/math/rng";

describe("weather", () => {
  it("only moves to states named in the table", () => {
    const rng = createRng(3);
    for (const k of Object.keys(WEATHER) as WeatherKind[]) {
      for (let i = 0; i < 50; i++) expect(Object.keys(WEATHER[k].next)).toContain(nextKind(k, rng));
    }
  });

  it("visits storms and calms over a long run and eases the wind", () => {
    const rng = createRng(11);
    const w = createWeather("breeze", 0, 11, rng);
    const seen = new Set<string>();
    let maxJump = 0;
    let prev = windNow(w, 0);
    let lightning = 0;
    for (let t = 0; t < 6 * 3600; t += 1) {
      const tick = stepWeather(w, t, 1, rng);
      if (tick.lightning) lightning++;
      seen.add(w.kind);
      const now = windNow(w, t);
      maxJump = Math.max(maxJump, Math.abs(now - prev));
      prev = now;
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    expect(maxJump).toBeLessThan(6);
    expect(lightning).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const run = () => {
      const rng = createRng(5);
      const w = createWeather("fresh", 1, 5, rng);
      for (let t = 0; t < 3600; t++) stepWeather(w, t, 1, rng);
      return JSON.stringify(w);
    };
    expect(run()).toBe(run());
  });
});
