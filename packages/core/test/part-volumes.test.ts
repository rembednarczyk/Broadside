import { describe, expect, it } from "vitest";
import { type ShipPart, auditClashes, boxDistance, segmentDistance, volumeGap } from "../src";

describe("volumes of ship parts", () => {
  it("measures the distance between two segments", () => {
    // Crossing at right angles one metre apart; parallel two apart; end to end.
    expect(segmentDistance([-1, 0, 0], [1, 0, 0], [0, 1, -1], [0, 1, 1])).toBeCloseTo(1, 9);
    expect(segmentDistance([0, 0, 0], [0, 5, 0], [2, 1, 0], [2, 4, 0])).toBeCloseTo(2, 9);
    expect(segmentDistance([0, 0, 0], [1, 0, 0], [3, 0, 0], [4, 0, 0])).toBeCloseTo(2, 9);
    expect(segmentDistance([0, 0, 0], [0, 0, 0], [0, 3, 4], [0, 3, 4])).toBeCloseTo(5, 9);
  });

  it("measures the distance from a point to a box", () => {
    expect(boxDistance([0, 0, 0], [-1, -1, -1], [1, 1, 1])).toBe(0);
    expect(boxDistance([4, 0, 0], [-1, -1, -1], [1, 1, 1])).toBeCloseTo(3, 9);
    expect(boxDistance([4, 5, 0], [-1, -1, -1], [1, 1, 1])).toBeCloseTo(5, 9);
  });

  it("finds a capsule that passes through a box, and lets one that passes beside it be", () => {
    const box = { shape: "box", min: [-2, 0, -2], max: [2, 2, 2] } as const;
    expect(volumeGap({ shape: "capsule", a: [-5, 1, 0], b: [5, 1, 0], r: 0.1 }, box)).toBeLessThan(0);
    expect(volumeGap(box, { shape: "capsule", a: [-5, 3, 0], b: [5, 3, 0], r: 0.1 })).toBeCloseTo(0.9, 6);
    expect(volumeGap(box, { shape: "box", min: [3, 0, 0], max: [4, 1, 1] })).toBeCloseTo(1, 9);
  });

  const castle: ShipPart = { id: "castle:stern", kind: "castle", at: [0, 3, -15], on: "hull", volumes: [{ shape: "box", min: [-4, 3, -20], max: [4, 5, -10] }] };
  const gun = (i: number, x: number): ShipPart => ({ id: `gun:${i}`, kind: "gun", at: [x, 4, -15], on: `carriage:${i}`, volumes: [{ shape: "capsule", a: [x - 1, 4, -15], b: [x + 1, 4, -15], r: 0.2 }] });

  it("reports a gun standing in the castle wall, unless the castle has a port for it", () => {
    expect(auditClashes([castle, gun(3, 3.5)])).toEqual([{ fault: "clash", part: "gun:3|castle:stern" }]);
    expect(auditClashes([castle, gun(3, 3.5), { id: "port:3", kind: "port", at: [4, 4, -15], on: "castle:stern" }])).toEqual([]);
    // A gun well clear of the castle is no clash.
    expect(auditClashes([castle, gun(4, 7)])).toEqual([]);
  });

  it("lets a yard cross its own mast, and reports one that crosses another", () => {
    const mast = (i: number, z: number): ShipPart => ({ id: `mast:${i}`, kind: "mast", at: [0, 0, z], on: "hull", volumes: [{ shape: "capsule", a: [0, 0, z], b: [0, 30, z], r: 0.3 }] });
    const yard: ShipPart = { id: "yard:0", kind: "yard", at: [0, 12, 5], on: "mast:0", volumes: [{ shape: "capsule", a: [-6, 12, 5], b: [6, 12, 5], r: 0.12 }] };
    expect(auditClashes([mast(0, 5.2), mast(1, -4), yard])).toEqual([]);
    expect(auditClashes([mast(0, 5.2), mast(1, 5.0), yard])).toEqual([{ fault: "clash", part: "yard:0|mast:1" }]);
  });
});
