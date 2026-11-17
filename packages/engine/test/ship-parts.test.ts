import { describe, expect, it } from "vitest";
import { SHIP_CLASS_IDS, auditParts } from "@broadside/core";
import { shipModel } from "@broadside/sim";
import { rigPlan } from "../src/renderer/rig-plan";
import { listShipParts, partBounds } from "../src/renderer/ship-parts";
import { SideProfile } from "../src/renderer/side-profile";

describe("parts of the generated ships", () => {
  it("every class is sound by the catalogue's rules: nothing orphaned, every mast stayed and shrouded", () => {
    for (const id of SHIP_CLASS_IDS) {
      const model = shipModel(id);
      const plan = rigPlan(model.def);
      const parts = listShipParts(model, plan);
      expect(auditParts(parts, partBounds(model, plan)), id).toEqual([]);
      // One gun part for every mount the simulation fires from, one mast part for every mast.
      expect(parts.filter((p) => p.kind === "gun"), id).toHaveLength(model.guns.length);
      expect(parts.filter((p) => p.kind === "mast"), id).toHaveLength(model.def.masts.length);
      expect(parts.filter((p) => p.kind === "shroud"), id).toHaveLength(model.def.masts.length * 8);
      expect(new Set(parts.map((p) => p.id)).size, id).toBe(parts.length);
    }
  });

  it("stays sound on a modelled hull, and reports a side that does not fit", () => {
    const model = shipModel("galleon");
    const plan = rigPlan(model.def);
    const h = model.def.hull;
    const stations = 32;
    const fit = { kx: 1, ky: 1, draft: h.draft, length: h.length };
    const good = new SideProfile({ half: Array.from({ length: stations }, () => h.beam * 0.45), top: Array.from({ length: stations }, () => h.draft + h.freeboard + 0.8) }, fit);
    expect(auditParts(listShipParts(model, plan, good), partBounds(model, plan))).toEqual([]);
    // A model twice as wide as the class: the channels and shrouds would hang off the ship.
    const wide = new SideProfile({ half: Array.from({ length: stations }, () => h.beam), top: Array.from({ length: stations }, () => h.draft + h.freeboard + 0.8) }, fit);
    const faults = auditParts(listShipParts(model, plan, wide), partBounds(model, plan));
    expect(faults.length).toBeGreaterThan(0);
    expect(faults.every((f) => f.fault === "outside" && /^(channel|shroud):/.test(f.part))).toBe(true);
  });
});
