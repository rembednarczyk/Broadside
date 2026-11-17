import { type PartBounds, type PartVolume, type ShipPart, partId } from "@broadside/core";
import { type ShipModel } from "@broadside/sim";
import { sternCastle } from "./castle-layout";
import { gunPlaces } from "./gun-layout";
import { deckAt } from "./hull-stations";
import { type RigPlan } from "./rig-plan";
import { YARD_CLEAR } from "./sail-geometry";
import { runningRigging, shroudLadders, stayEnds } from "./rig-layout";
import { type SideProfile } from "./side-profile";

/**
 * The parts of a ship as the view builds her, named after the catalogue in core (`ShipPart`): the
 * same layouts the meshes are made from (rig plan, stays, shroud ladders, gun mounts), listed with
 * their carriers, so `auditParts` can judge any class the generators produce.
 */
const MAST_RADIUS = 0.3;
const ROPE_RADIUS = 0.03;
const capsule = (a: readonly [number, number, number], b: readonly [number, number, number], r: number): PartVolume => ({ shape: "capsule", a, b, r });

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
    const foot = t.y - model.def.masts[i]!.height;
    parts.push({ id: partId("mast", i), kind: "mast", at: [0, foot, t.z], on: "hull", volumes: [capsule([0, foot, t.z], [0, t.y, t.z], MAST_RADIUS)] });
  });
  const mastAt = (z: number): number => Math.max(0, model.def.masts.findIndex((m) => Math.abs(m.z - z) < 1e-6));
  plan.tops.forEach((t, i) => parts.push({ id: partId("top", i), kind: "top", at: [0, t.y, t.z], on: partId("mast", mastAt(t.z)) }));
  plan.sails.forEach((s, i) => {
    const mast = partId("mast", s.mast);
    // A square tier hangs from its own yard; fore-and-aft canvas is bent to its mast, a jib runs on the bowsprit.
    // (A gaff is named apart: it is peaked by halyards, not braced.)
    const yard = s.shape === "gaff" ? partId("yard", "gaff", i) : partId("yard", i);
    const y = s.foot + s.height;
    // A square yard lies athwartships before its mast (braced square for the rule); a gaff is left without a volume.
    if (s.yard) parts.push({ id: yard, kind: "yard", at: [0, y, s.nodeZ], on: mast, ...(s.shape === "square" ? { volumes: [capsule([-s.width / 2, y, s.nodeZ + YARD_CLEAR], [s.width / 2, y, s.nodeZ + YARD_CLEAR], 0.12)] } : {}) });
    parts.push({ id: partId("sail", i), kind: "sail", at: [0, s.foot + s.height / 2, s.nodeZ], on: s.yard ? yard : s.shape === "jib" ? "bowsprit" : mast });
  });
  stayEnds(plan.mastTops, plan.bowspritEnd, h, side).forEach((e, i) => parts.push({ id: partId("stay", i), kind: "stay", at: e.a, on: partId("mast", e.from), volumes: [capsule(e.a, e.b, ROPE_RADIUS)] }));
  runningRigging(plan, h).forEach((l, i) => {
    const s = plan.sails[l.from.plan]!;
    // Anchored where the line is made fast (a hull point), or at the sail it comes from.
    const at: [number, number, number] = "plan" in l.to ? [0, s.foot + (l.from.row === "head" ? s.height : 0), s.nodeZ] : [l.to.aside, l.to.y, l.to.z];
    const onSail = l.kind === "sheet" || l.kind === "clewline";
    parts.push({ id: partId(l.kind, i), kind: l.kind, at, on: onSail ? partId("sail", l.from.plan) : s.shape === "gaff" ? partId("yard", "gaff", l.from.plan) : partId("yard", l.from.plan) });
  });
  for (const l of shroudLadders(model, side)) {
    const channel = partId("channel", l.mast, sideName(l.side));
    const mid = l.shrouds[0]!.foot;
    parts.push({ id: channel, kind: "channel", at: [mid[0], mid[1] - 0.05, model.def.masts[l.mast]!.z], on: "hull" });
    l.shrouds.forEach((s, k) => parts.push({ id: partId("shroud", l.mast, sideName(l.side), k), kind: "shroud", at: s.foot, on: channel, volumes: [capsule(s.foot, s.head, ROPE_RADIUS)] }));
  }
  const places = gunPlaces(model, side ? (_, z) => side.halfAt(z) : null);
  model.guns.forEach((g, i) => {
    const place = places[i]!;
    const at: [number, number, number] = [g.pos.x + model.com.x, g.pos.y + model.com.y, g.pos.z + model.com.z];
    const half = place.length / 2;
    const end = (k: number): [number, number, number] => [place.at[0] + place.dir[0] * k, place.at[1] + place.dir[1] * k, place.at[2] + place.dir[2] * k];
    const volumes = [capsule(end(-half), end(half), 0.2)];
    // A swivel stands on the rail; every other gun on a carriage (a mortar's bed) on the deck.
    if (g.kind === "swivel") parts.push({ id: partId("gun", i), kind: "gun", at, on: partId("rail", sideName(at[0])), volumes });
    else {
      parts.push({ id: partId("carriage", i), kind: "carriage", at, on: "deck" });
      parts.push({ id: partId("gun", i), kind: "gun", at, on: partId("carriage", i), volumes });
    }
  });
  const castle = side ? sternCastle(side, places) : null;
  if (castle) {
    // The castle as a box between each pair of its stations, as wide as the narrower of the two.
    const volumes = castle.ring.slice(1).map((r, k): PartVolume => {
      const half = Math.min(r.half, castle.ring[k]!.half);
      return { shape: "box", min: [-half, castle.base, castle.ring[k]!.z], max: [half, castle.top, r.z] };
    });
    parts.push({ id: partId("castle", "stern"), kind: "castle", at: [0, castle.base, castle.ring[0]!.z], on: "hull", volumes });
    castle.ports.forEach((port) => parts.push({ id: partId("port", port.gun), kind: "port", at: port.at, on: partId("castle", "stern") }));
    castle.lanterns.forEach((l, i) => parts.push({ id: partId("lantern", i), kind: "lantern", at: l, on: partId("castle", "stern") }));
  }
  const tallest = plan.mastTops.reduce((best, t, i) => (t.y > plan.mastTops[best]!.y ? i : best), 0);
  parts.push({ id: "flag", kind: "flag", at: [0, plan.mastTops[tallest]!.y + 0.2, plan.mastTops[tallest]!.z], on: partId("mast", tallest) });
  return parts;
};

/** The box a ship's parts must lie in (for `auditParts`). */
export const partBounds = (model: ShipModel, plan: RigPlan): PartBounds => ({ length: model.def.hull.length, beam: model.def.hull.beam, draft: model.def.hull.draft, height: Math.max(...plan.mastTops.map((t) => t.y)) });
