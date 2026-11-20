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

describe("a blow building", () => {
  it("takes minutes, not seconds, from a fresh breeze to a storm's wind", () => {
    const rng = createRng(5);
    const w = createWeather("fresh", 0, 5, rng);
    w.kind = "storm";
    w.left = 1e6;
    w.meanWind = 10;
    w.targetWind = 24;
    for (let t = 0; t < 80; t += 0.5) stepWeather(w, t, 0.5, rng);
    // Before: about 23 m/s after 80 s.
    expect(w.meanWind).toBeLessThan(19);
    for (let t = 80; t < 300; t += 0.5) stepWeather(w, t, 0.5, rng);
    expect(w.meanWind).toBeGreaterThan(22);
  });

  it("lets a gale and a storm last five minutes at least", () => {
    expect(WEATHER.gale.minutes[0]).toBeGreaterThanOrEqual(5);
    expect(WEATHER.storm.minutes[0]).toBeGreaterThanOrEqual(5);
  });
});
