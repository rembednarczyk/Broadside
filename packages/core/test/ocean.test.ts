import { describe, expect, it } from "vitest";
import { displacement, makeWave, waterHeight, waterNormal, packWaves, MAX_WAVES } from "../src/ocean/gerstner";
import { seaWaves, waveBands, significantHeight, spectrum, peakOmega } from "../src/ocean/sea-state";

describe("Gerstner waves", () => {
  const waves = seaWaves(waveBands(7, 0.3), { windSpeed: 10, swell: 0 });

  it("finds the height under a world point, not under the displaced rest point", () => {
    for (const [x, z, t] of [[0, 0, 0], [13.2, -40, 3.3], [-77, 12, 9.1]] as const) {
      const h = waterHeight(waves, x, z, t);
      // Search the rest point brute force on a grid and compare.
      let best = Infinity;
      let bestY = 0;
      for (let dx = -6; dx <= 6; dx += 0.05) {
        for (let dz = -6; dz <= 6; dz += 0.5) {
          const d = displacement(waves, x + dx, z + dz, t);
          const err = Math.hypot(x + dx + d.x - x, z + dz + d.z - z);
          if (err < best) {
            best = err;
            bestY = d.y;
          }
        }
      }
      expect(Math.abs(h - bestY)).toBeLessThan(0.15);
    }
  });

  it("keeps the orbit at most circular and loop-free", () => {
    const w = makeWave(0, 50, 0.001, 0.8, 0, 8);
    expect(w.qa).toBeLessThanOrEqual(0.8 * 0.001 + 1e-12);
    const sum = waves.reduce((s, x) => s + x.k * x.qa, 0);
    expect(sum).toBeLessThanOrEqual(1);
  });

  it("gives a unit normal pointing up", () => {
    const n = waterNormal(waves, 5, 5, 2);
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
    expect(n.y).toBeGreaterThan(0.5);
  });

  it("packs at most MAX_WAVES waves for the shader", () => {
    const p = packWaves(waves);
    expect(p.count).toBe(MAX_WAVES);
    expect(p.a[2]).toBeCloseTo(waves[0]!.k, 5);
  });
});

describe("sea state", () => {
  it("grows with the wind and stays calm without it", () => {
    const bands = waveBands(1, 0);
    const rms = (u: number) => Math.sqrt(seaWaves(bands, { windSpeed: u, swell: 0 }).reduce((s, w) => s + w.amplitude ** 2, 0));
    expect(rms(0)).toBeLessThan(0.2);
    expect(rms(8)).toBeGreaterThan(rms(4));
    expect(rms(20)).toBeGreaterThan(rms(8) * 2);
  });

  it("matches the Pierson-Moskowitz significant height within the game scale", () => {
    expect(significantHeight(10)).toBeCloseTo(2.14, 1);
    expect(spectrum(1, 0)).toBe(0);
  });

  it("is deterministic for a seed", () => {
    expect(waveBands(42, 1)).toEqual(waveBands(42, 1));
    expect(waveBands(42, 1)).not.toEqual(waveBands(43, 1));
  });
});

describe("JONSWAP sea", () => {
  it("peaks shorter than a fully developed sea and stays below its height", () => {
    const bands = waveBands(1, 0);
    const waves = seaWaves(bands, { windSpeed: 15, swell: 0 });
    const hs = 4 * Math.sqrt(waves.reduce((s, w) => s + (w.amplitude * w.amplitude) / 2, 0));
    expect(hs).toBeGreaterThan(1);
    expect(hs).toBeLessThan(significantHeight(15));
    const wp = peakOmega(15);
    expect((2 * Math.PI * 9.81) / (wp * wp)).toBeLessThan(120);
  });
});
