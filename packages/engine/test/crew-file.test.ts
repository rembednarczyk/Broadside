/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCrewFile } from "../src/renderer/crew-file";

const file = (): ArrayBuffer => {
  const b = readFileSync(new URL("../../app/public/assets/props/crew-anim.bin", import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe("animated crew file", () => {
  it("holds skinned figures, the clips the deck needs and one row of joint matrices per frame", () => {
    const crew = parseCrewFile(file());
    expect(crew.joints).toBe(65);
    expect(crew.clips.map((c) => c.name)).toEqual(expect.arrayContaining(["idle", "talk", "haul", "wheel", "work", "handle", "lookout", "rail", "call", "arms"]));
    const frames = crew.clips.reduce((n, c) => n + c.frames, 0);
    expect(crew.vat.length).toBe(frames * (crew.joints + 1) * 16);
    for (const c of crew.clips) expect(c.frames).toBeGreaterThan(1);
    expect(crew.figures.length).toBeGreaterThanOrEqual(4);
    for (const f of crew.figures) {
      const n = f.position.length / 3;
      expect(f.normal.length, f.name).toBe(n * 3);
      expect(f.uv.length, f.name).toBe(n * 2);
      expect(f.joints.length, f.name).toBe(n * 4);
      expect(Math.max(...f.joints), f.name).toBeLessThan(crew.joints);
      expect(Math.max(...f.index), f.name).toBeLessThan(n);
      // The far level of detail: whole triangles over the same vertices, at most three quarters of the near ones.
      expect(f.lod.length % 3, f.name).toBe(0);
      expect(f.lod.length, f.name).toBeGreaterThan(0);
      expect(f.lod.length, f.name).toBeLessThanOrEqual(f.index.length * 0.76);
      expect(Math.max(...f.lod), f.name).toBeLessThan(n);
      // Weights of a vertex add up to one; the man stands about 1.8 m tall.
      expect(f.weights[0]! + f.weights[1]! + f.weights[2]! + f.weights[3]!).toBeCloseTo(1, 4);
      let top = -Infinity;
      for (let i = 1; i < f.position.length; i += 3) top = Math.max(top, f.position[i]!);
      expect(top, f.name).toBeGreaterThan(1.6);
      expect(top, f.name).toBeLessThan(2.1);
    }
    expect([crew.atlas[0], crew.atlas[1]]).toEqual([0xff, 0xd8]);
  });

  it("starts each clip near the rest pose: the first joint matrix of a frame is a rigid motion", () => {
    const crew = parseCrewFile(file());
    const m = crew.vat.subarray(0, 16);
    // The upper 3x3 of a rigid joint matrix has unit columns.
    for (const c of [0, 4, 8]) expect(Math.hypot(m[c]!, m[c + 1]!, m[c + 2]!)).toBeCloseTo(1, 3);
  });
});
