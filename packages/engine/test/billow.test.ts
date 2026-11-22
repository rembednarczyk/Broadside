import { describe, expect, it } from "vitest";
import { billowBlobs } from "../src/effects/billow";

describe("billow sprite", () => {
  it("is the same for the same seed and differs between seeds", () => {
    expect(billowBlobs(3)).toEqual(billowBlobs(3));
    expect(billowBlobs(3)).not.toEqual(billowBlobs(4));
  });

  it("stays inside its cell (soft edge fades before the cell border)", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const b of billowBlobs(seed)) {
        expect(b.r).toBeGreaterThan(0);
        expect(Math.hypot(b.x - 0.5, b.y - 0.5) + b.r).toBeLessThanOrEqual(0.4801);
      }
    }
  });

  it("is lit from above: upper blobs brighter, painted last", () => {
    const blobs = billowBlobs(7);
    for (let i = 1; i < blobs.length; i++) expect(blobs[i]!.y).toBeLessThanOrEqual(blobs[i - 1]!.y);
    const top = blobs[blobs.length - 1]!;
    const bottom = blobs[0]!;
    expect(top.shade).toBeGreaterThan(bottom.shade);
  });
});
