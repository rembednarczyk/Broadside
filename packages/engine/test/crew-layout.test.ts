import { describe, expect, it } from "vitest";
import { shipModel } from "@broadside/sim";
import { sternCastle } from "../src/renderer/castle-layout";
import { crewFigures, modelCrewSpots } from "../src/renderer/crew-layout";
import { type CrewActivity, crewClip } from "../src/renderer/crew-roles";
import { gunPlaces } from "../src/renderer/gun-layout";
import { rigPlan } from "../src/renderer/rig-plan";
import { SideProfile, hullFit } from "../src/renderer/side-profile";
import galleonMetrics from "../../app/public/assets/hulls/galleon.json";
import brigMetrics from "../../app/public/assets/hulls/brig.json";

const decks = (id: "galleon" | "brig", withCastle: boolean) => {
  const model = shipModel(id);
  const h = model.def.hull;
  const m = id === "galleon" ? galleonMetrics : brigMetrics;
  const side = new SideProfile({ ...m.profile, ...("height" in m ? { cut: m.height as number } : {}) }, { ...hullFit(m, h), draft: h.draft, length: m.length });
  const guns = gunPlaces(model, (_, z) => side.halfAt(z));
  return { model, side, guns, castle: withCastle ? sternCastle(side, guns) : null, tops: rigPlan(model.def).tops };
};

describe("crew stations on a modelled hull", () => {
  it("mans the wheel and the maintop first, then the taffrail, halyards, braces, guns and waist", () => {
    const d = decks("galleon", true);
    const spots = modelCrewSpots(d.model, d);
    expect(spots).toHaveLength(crewFigures(d.model.def.crew));
    expect(spots[0]!.role).toBe("wheel");
    expect(spots[1]!.role).toBe("lookout");
    // The lookout stands in a top, far above the deck.
    expect(spots[1]!.at[1]).toBeGreaterThan(spots[0]!.at[1] + 8);
    expect(spots.filter((s) => s.role === "rail").length).toBeGreaterThanOrEqual(4);
    const roles = new Set(spots.map((s) => s.role));
    for (const r of ["gun", "halyard"] as const) expect(roles.has(r), r).toBe(true);
    // Those at the taffrail look aft over it.
    for (const s of spots.filter((x) => x.role === "rail")) expect(Math.cos(s.yaw)).toBeLessThan(-0.9);
    // Every man stands inside the side, and no two on one spot.
    for (const s of spots) expect(Math.abs(s.at[0]), s.role).toBeLessThan(d.side.halfAt(s.at[2]));
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i]!.at[0] - spots[j]!.at[0], spots[i]!.at[2] - spots[j]!.at[2]) + Math.abs(spots[i]!.at[1] - spots[j]!.at[1])).toBeGreaterThan(0.5);
    expect(modelCrewSpots(d.model, d)).toEqual(spots);
  });

  it("stands the crew on a hull without a castle", () => {
    const d = decks("brig", false);
    const spots = modelCrewSpots(d.model, d);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots[0]!.role).toBe("wheel");
  });
});

describe("what the men do", () => {
  const calm: CrewActivity = { bracing: [false, false, false], handling: [false, false, false], sinceFired: () => Infinity, beaten: false };
  it("follows the ship: braces hauled while the yards swing, guns served after a shot, halyards when sail is set", () => {
    expect(crewClip("brace", 1, 0, calm)).not.toBe("haul");
    expect(crewClip("brace", 1, 0, { ...calm, bracing: [false, true, false] })).toBe("haul");
    expect(crewClip("gun", 4, 0, { ...calm, sinceFired: (g) => (g === 4 ? 3 : Infinity) })).toBe("handle");
    expect(crewClip("gun", 5, 0, { ...calm, sinceFired: (g) => (g === 4 ? 3 : Infinity) })).not.toBe("handle");
    expect(crewClip("halyard", 2, 0, { ...calm, handling: [false, false, true] })).toBe("haul");
    expect(crewClip("wheel", -1, 0, calm)).toBe("wheel");
    expect(crewClip("lookout", 1, 0, calm)).toBe("lookout");
    // A beaten crew stands idle, whatever the ship does.
    expect(["idle", "talk"]).toContain(crewClip("brace", 1, 0, { ...calm, bracing: [true, true, true], beaten: true }));
  });
});
