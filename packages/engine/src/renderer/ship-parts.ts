import { type PartBounds, type ShipPart, partId } from "@broadside/core";
import { type ShipModel } from "@broadside/sim";
import { deckAt } from "./hull-stations";
import { type RigPlan } from "./rig-plan";
import { runningRigging, shroudLadders, stayEnds } from "./rig-layout";
import { type SideProfile } from "./side-profile";

/**
 * The parts of a ship as the view builds her, named after the catalogue in core (`ShipPart`): the
 * same layouts the meshes are made from (rig plan, stays, shroud ladders, gun mounts), listed with
 * their carriers, so `auditParts` can judge any class the generators produce.
 */
const sideName = (x: number): "port" | "starboard" => (x < 0 ? "port" : "starboard");

export const listShipParts = (model: ShipModel, plan: RigPlan, side: SideProfile | null = null): ShipPart[] => {
  const h = model.def.hull;
  const parts: ShipPart[] = [
    { id: "hull", kind: "hull", at: [0, 0, 0], on: null },
    { id: "deck", kind: "deck", at: [0, deckAt(h, 0), 0], on: "hull" },
    { id: "bowsprit", kind: "bowsprit", at: [0, plan.bowspritEnd.y, plan.bowspritEnd.z], on: "hull" },
    { id: partId("rail", "port"), kind: "rail", at: [-h.beam / 2, h.freeboard + 0.8, 0], on: "hull" },
    { id: partId("rail", "starboard"), kind: "rail", at: [h.beam / 2, h.freeboard + 0.8, 0], on: "hull" },
  ];
  plan.mastTops.forEach((t, i) => {
    parts.push({ id: partId("mast", i), kind: "mast", at: [0, t.y - model.def.masts[i]!.height, t.z], on: "hull" });
  });
  const mastAt = (z: number): number => Math.max(0, model.def.masts.findIndex((m) => Math.abs(m.z - z) < 1e-6));
  plan.tops.forEach((t, i) => parts.push({ id: partId("top", i), kind: "top", at: [0, t.y, t.z], on: partId("mast", mastAt(t.z)) }));
  plan.sails.forEach((s, i) => {
    const mast = partId("mast", s.mast);
    // A square tier hangs from its own yard; fore-and-aft canvas is bent to its mast, a jib runs on the bowsprit.
    // (A gaff is named apart: it is peaked by halyards, not braced.)
    const yard = s.shape === "gaff" ? partId("yard", "gaff", i) : partId("yard", i);
    if (s.yard) parts.push({ id: yard, kind: "yard", at: [0, s.foot + s.height, s.nodeZ], on: mast });
    parts.push({ id: partId("sail", i), kind: "sail", at: [0, s.foot + s.height / 2, s.nodeZ], on: s.yard ? yard : s.shape === "jib" ? "bowsprit" : mast });
  });
  stayEnds(plan.mastTops, plan.bowspritEnd, h).forEach((e, i) => parts.push({ id: partId("stay", i), kind: "stay", at: e.a, on: partId("mast", e.from) }));
  runningRigging(plan, h).forEach((l, i) => {
    const s = plan.sails[l.from.plan]!;
    // Anchored where the line is made fast (a hull point), or at the sail it comes from.
    const at: [number, number, number] = "plan" in l.to ? [0, s.foot + (l.from.row === "head" ? s.height : 0), s.nodeZ] : [l.to.aside, l.to.y, l.to.z];
    parts.push({ id: partId(l.kind, i), kind: l.kind, at, on: l.kind === "sheet" ? partId("sail", l.from.plan) : partId("yard", l.from.plan) });
  });
  for (const l of shroudLadders(model, side)) {
    const channel = partId("channel", l.mast, sideName(l.side));
    const mid = l.shrouds[0]!.foot;
    parts.push({ id: channel, kind: "channel", at: [mid[0], mid[1] - 0.05, model.def.masts[l.mast]!.z], on: "hull" });
    l.shrouds.forEach((s, k) => parts.push({ id: partId("shroud", l.mast, sideName(l.side), k), kind: "shroud", at: s.foot, on: channel }));
  }
  model.guns.forEach((g, i) => {
    const at: [number, number, number] = [g.pos.x + model.com.x, g.pos.y + model.com.y, g.pos.z + model.com.z];
    // A swivel stands on the rail; every other gun on a carriage (a mortar's bed) on the deck.
    if (g.kind === "swivel") parts.push({ id: partId("gun", i), kind: "gun", at, on: partId("rail", sideName(at[0])) });
    else {
      parts.push({ id: partId("carriage", i), kind: "carriage", at, on: "deck" });
      parts.push({ id: partId("gun", i), kind: "gun", at, on: partId("carriage", i) });
    }
  });
  const tallest = plan.mastTops.reduce((best, t, i) => (t.y > plan.mastTops[best]!.y ? i : best), 0);
  parts.push({ id: "flag", kind: "flag", at: [0, plan.mastTops[tallest]!.y + 0.2, plan.mastTops[tallest]!.z], on: partId("mast", tallest) });
  return parts;
};

/** The box a ship's parts must lie in (for `auditParts`). */
export const partBounds = (model: ShipModel, plan: RigPlan): PartBounds => ({ length: model.def.hull.length, beam: model.def.hull.beam, draft: model.def.hull.draft, height: Math.max(...plan.mastTops.map((t) => t.y)) });
