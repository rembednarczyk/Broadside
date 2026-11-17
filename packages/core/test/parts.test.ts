import { describe, expect, it } from "vitest";
import { type ShipPart, auditParts, partId } from "../src/ship/parts";

const bounds = { length: 30, beam: 8, draft: 3, height: 30 };
const sound = (): ShipPart[] => [
  { id: "hull", kind: "hull", at: [0, 0, 0], on: null },
  { id: "deck", kind: "deck", at: [0, 2, 0], on: "hull" },
  { id: partId("mast", 0), kind: "mast", at: [0, 2, 3], on: "hull" },
  { id: partId("stay", 0, 0), kind: "stay", at: [0, 28, 3], on: partId("mast", 0) },
  { id: partId("channel", 0, "port"), kind: "channel", at: [-4.2, 2.5, 3], on: "hull" },
  { id: partId("channel", 0, "starboard"), kind: "channel", at: [4.2, 2.5, 3], on: "hull" },
  { id: partId("shroud", 0, "port", 0), kind: "shroud", at: [-4.2, 2.6, 3], on: partId("channel", 0, "port") },
  { id: partId("shroud", 0, "starboard", 0), kind: "shroud", at: [4.2, 2.6, 3], on: partId("channel", 0, "starboard") },
  { id: partId("yard", 0, 0), kind: "yard", at: [0, 12, 3], on: partId("mast", 0) },
  { id: partId("sail", 0, 0), kind: "sail", at: [0, 8, 3], on: partId("yard", 0, 0) },
  { id: partId("sheet", 0), kind: "sheet", at: [3.5, 2.9, 1], on: partId("sail", 0, 0) },
  { id: partId("brace", 0), kind: "brace", at: [3.4, 2.9, -8], on: partId("yard", 0, 0) },
  { id: partId("brace", 1), kind: "brace", at: [-3.4, 2.9, -8], on: partId("yard", 0, 0) },
  { id: partId("carriage", 0), kind: "carriage", at: [3, 2.2, 0], on: "deck" },
  { id: partId("gun", 0), kind: "gun", at: [3.4, 2.6, 0], on: partId("carriage", 0) },
];
const faultsOf = (parts: ShipPart[]): string[] => auditParts(parts, bounds).map((f) => `${f.fault}:${f.part}`);

describe("ship parts catalogue", () => {
  it("passes a sound ship", () => {
    expect(auditParts(sound(), bounds)).toEqual([]);
  });

  it("names parts by kind and place", () => {
    expect(partId("shroud", 1, "port", 3)).toBe("shroud:1:port:3");
  });

  it("finds a part with no carrier, the wrong carrier, or hanging outside the ship", () => {
    expect(faultsOf(sound().filter((p) => p.id !== "carriage:0"))).toEqual(["orphan:gun:0"]);
    expect(faultsOf(sound().map((p) => (p.id === "sail:0:0" ? { ...p, on: "deck" } : p)))).toEqual(["wrongCarrier:sail:0:0"]);
    expect(faultsOf(sound().map((p) => (p.id === "gun:0" ? { ...p, at: [9, 2.6, 0] as const } : p)))).toEqual(["outside:gun:0"]);
    expect(faultsOf([...sound(), sound()[1]!])).toContain("duplicate:deck");
  });

  it("wants every mast stayed and shrouded on both sides", () => {
    expect(faultsOf(sound().filter((p) => p.kind !== "stay"))).toEqual(["unstayed:mast:0"]);
    expect(faultsOf(sound().filter((p) => p.id !== "shroud:0:port:0"))).toEqual(["noShrouds:mast:0"]);
    expect(faultsOf(sound().filter((p) => p.id !== "hull"))).toContain("noHull:hull");
  });

  it("wants a sheet to every sail and a brace to each arm of every yard", () => {
    expect(faultsOf(sound().filter((p) => p.kind !== "sheet"))).toEqual(["noSheet:sail:0:0"]);
    expect(faultsOf(sound().filter((p) => p.id !== "brace:1"))).toEqual(["noBraces:yard:0:0"]);
  });
});
