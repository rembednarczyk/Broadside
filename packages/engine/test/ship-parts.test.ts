import { describe, expect, it } from "vitest";
import { SHIP_CLASS_IDS, auditClashes, auditParts } from "@broadside/core";
import { shipModel } from "@broadside/sim";
import { rigPlan } from "../src/renderer/rig-plan";
import { listShipParts, partBounds } from "../src/renderer/ship-parts";
import { SideProfile, hullFit } from "../src/renderer/side-profile";
import { sternCastle } from "../src/renderer/castle-layout";
import { gunPlaces } from "../src/renderer/gun-layout";
import galleonMetrics from "../../app/public/assets/hulls/galleon.json";
import frigateMetrics from "../../app/public/assets/hulls/frigate.json";
import brigMetrics from "../../app/public/assets/hulls/brig.json";

describe("parts of the generated ships", () => {
  it("every class is sound by the catalogue's rules: nothing orphaned, every mast stayed and shrouded", () => {
    for (const id of SHIP_CLASS_IDS) {
      const model = shipModel(id);
      const plan = rigPlan(model.def);
      const parts = listShipParts(model, plan);
      expect(auditParts(parts, partBounds(model, plan)), id).toEqual([]);
      expect(auditClashes(parts), id).toEqual([]);
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

  it("no part runs through another on the modelled hulls: guns in the castle have their ports", () => {
    const metrics = { galleon: galleonMetrics, frigate: frigateMetrics, brig: brigMetrics } as const;
    for (const id of ["galleon", "frigate", "brig"] as const) {
      const m = metrics[id];
      const model = shipModel(id);
      const plan = rigPlan(model.def);
      const h = model.def.hull;
      const side = new SideProfile({ ...m.profile, ...("height" in m ? { cut: m.height } : {}) }, { ...hullFit(m, h), draft: h.draft, length: m.length });
      const parts = listShipParts(model, plan, side);
      expect(auditClashes(parts), id).toEqual([]);
      expect(auditParts(parts, partBounds(model, plan)), id).toEqual([]);
      // Every port serves a gun whose barrel really lies in the castle.
      const castle = sternCastle(side, gunPlaces(model, (_, z) => side.halfAt(z)));
      for (const port of castle?.ports ?? []) expect(port.at[1], id).toBeGreaterThan(castle!.base - 0.2);
    }
    // A gun placed in the galleon's castle gets a port on the wall at its station, on its side;
    // a stern chaser one in the transom.
    const g = shipModel("galleon");
    const gh = g.def.hull;
    const gs = new SideProfile({ ...galleonMetrics.profile, cut: galleonMetrics.height }, { ...hullFit(galleonMetrics, gh), draft: gh.draft, length: galleonMetrics.length });
    const bare = sternCastle(gs)!;
    expect(bare.ports).toEqual([]);
    const y = bare.base + 1;
    const z = (bare.ring[0]!.z + bare.ring[bare.ring.length - 1]!.z) / 2;
    const ports = sternCastle(gs, [{ at: [-2.5, y, z], dir: [-1, 0, 0], length: 2 }, { at: [1, y, bare.ring[0]!.z + 0.8], dir: [0, 0, -1], length: 2 }, { at: [3, bare.top + 2, z], dir: [1, 0, 0], length: 2 }])!.ports;
    expect(ports.map((p) => p.gun)).toEqual([0, 1]);
    expect(ports[0]!.n).toEqual([-1, 0, 0]);
    expect(ports[0]!.at[0]).toBeLessThan(-3);
    expect(ports[1]!.n).toEqual([0, 0, -1]);
    expect(ports[1]!.at[2]).toBeCloseTo(bare.ring[0]!.z, 9);
  });
});
