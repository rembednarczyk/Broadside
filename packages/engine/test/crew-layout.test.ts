import { describe, expect, it } from "vitest";
import { shipModel } from "@broadside/sim";
import { sternCastle } from "../src/renderer/castle-layout";
import { crewFigures, modelCrewSpots } from "../src/renderer/crew-layout";
import { gunPlaces } from "../src/renderer/gun-layout";
import { SideProfile, hullFit } from "../src/renderer/side-profile";
import galleonMetrics from "../../app/public/assets/hulls/galleon.json";
import brigMetrics from "../../app/public/assets/hulls/brig.json";

describe("crew on a modelled hull", () => {
  it("lines the sterncastle's rail facing aft and fills the waist clear of masts and guns", () => {
    const model = shipModel("galleon");
    const h = model.def.hull;
    const side = new SideProfile({ ...galleonMetrics.profile, cut: galleonMetrics.height }, { ...hullFit(galleonMetrics, h), draft: h.draft, length: galleonMetrics.length });
    const guns = gunPlaces(model, (_, z) => side.halfAt(z));
    const castle = sternCastle(side, guns)!;
    const spots = modelCrewSpots(model, side, castle, guns);
    expect(spots).toHaveLength(crewFigures(model.def.crew));
    const onCastle = spots.filter((s) => s.at[1] === castle.top);
    expect(onCastle.length).toBeGreaterThanOrEqual(6);
    for (const s of onCastle) expect(Math.cos(s.yaw)).toBeLessThan(-0.9);
    for (const s of spots) {
      expect(Math.abs(s.at[0]), "inside the side").toBeLessThan(side.halfAt(s.at[2]));
      expect(guns.every((g) => Math.hypot(g.at[0] - s.at[0], g.at[2] - s.at[2]) >= 1.4 || s.at[1] === castle.top)).toBe(true);
    }
    // The same every time.
    expect(modelCrewSpots(model, side, castle, guns)).toEqual(spots);
  });

  it("stands the whole crew in the waist of a hull without a castle", () => {
    const model = shipModel("brig");
    const h = model.def.hull;
    const side = new SideProfile(brigMetrics.profile, { ...hullFit(brigMetrics, h), draft: h.draft, length: brigMetrics.length });
    const spots = modelCrewSpots(model, side, null, gunPlaces(model, (_, z) => side.halfAt(z)));
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.length).toBeLessThanOrEqual(crewFigures(model.def.crew));
    for (const s of spots) expect(s.at[1]).toBeCloseTo(side.topAt(s.at[2]) - 0.95, 6);
  });
});
