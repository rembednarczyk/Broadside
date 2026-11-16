import { type ShipClassDef } from "@broadside/core";
import { type SailShape } from "./sail-geometry";

/**
 * Visual rig plan of a class, in hull space (pure data, tested): masts in three spars (lower
 * mast, topmast, topgallant) with tops, a steep bowsprit, and the canvas split the way a square
 * rigger carries it: course, topsail and topgallant on separate yards (the physics sees one sail
 * per definition; the view shows its tiers). Tiers appear in the order sail is made: topsails
 * first, then courses, then topgallants (period practice when making sail in a breeze).
 */
export interface Spar {
  readonly x0: number;
  readonly y0: number;
  readonly z0: number;
  readonly x1: number;
  readonly y1: number;
  readonly z1: number;
  readonly diameter: number;
}

export interface SailPlan {
  /** Physics mast and sail index this canvas belongs to (for set, chord and fill). */
  readonly mast: number;
  readonly sail: number;
  readonly shape: SailShape;
  readonly width: number;
  readonly height: number;
  /** Foot height above the waterline. */
  readonly foot: number;
  /** Position of the sail node along the hull (the mast or the bowsprit). */
  readonly nodeZ: number;
  readonly nodeY: number;
  /** Share of the set factor where this canvas starts to show, and over how much it opens. */
  readonly setFrom: number;
  readonly setSpan: number;
  /** Whether the yard of this canvas turns with the sail's trim (square tiers). */
  readonly yard: boolean;
  readonly emblem: boolean;
}

export interface RigPlan {
  readonly spars: readonly Spar[];
  readonly tops: readonly { readonly y: number; readonly z: number; readonly diameter: number }[];
  readonly sails: readonly SailPlan[];
  /** Bowsprit end in hull space (for stays). */
  readonly bowspritEnd: { readonly y: number; readonly z: number };
  readonly mastTops: readonly { readonly y: number; readonly z: number }[];
}

const TIERS = [
  { share: 0.44, from: 0.1, to: 0.4, setFrom: 0.45, setSpan: 0.4, widthK: 1 },
  { share: 0.36, from: 0.44, to: 0.7, setFrom: 0, setSpan: 0.45, widthK: 0.86 },
  { share: 0.2, from: 0.74, to: 0.92, setFrom: 0.75, setSpan: 0.25, widthK: 0.66 },
] as const;

const BOWSPRIT_ANGLE = 0.5;

export const rigPlan = (def: ShipClassDef): RigPlan => {
  const h = def.hull;
  const F = h.freeboard;
  const spars: Spar[] = [];
  const tops: { y: number; z: number; diameter: number }[] = [];
  const sails: SailPlan[] = [];
  const mastTops: { y: number; z: number }[] = [];
  const base = h.freeboard + h.sheer * 0.6 + 0.9;
  const bsLen = h.length * 0.3;
  const bowspritEnd = { y: base + Math.sin(BOWSPRIT_ANGLE) * bsLen, z: h.length / 2 - 1 + Math.cos(BOWSPRIT_ANGLE) * bsLen };
  spars.push({ x0: 0, y0: base - 0.4, z0: h.length / 2 - 3, x1: 0, y1: bowspritEnd.y, z1: bowspritEnd.z, diameter: 0.3 + h.beam * 0.015 });
  def.masts.forEach((m, mi) => {
    const H = m.height;
    const d = 0.35 + h.beam * 0.035;
    spars.push({ x0: 0, y0: F - 0.5, z0: m.z, x1: 0, y1: F + H * 0.6, z1: m.z, diameter: d });
    spars.push({ x0: 0, y0: F + H * 0.54, z0: m.z, x1: 0, y1: F + H * 0.86, z1: m.z, diameter: d * 0.62 });
    spars.push({ x0: 0, y0: F + H * 0.82, z0: m.z, x1: 0, y1: F + H, z1: m.z, diameter: d * 0.38 });
    if (H > 16) tops.push({ y: F + H * 0.58, z: m.z, diameter: Math.min(4.5, h.beam * 0.4) });
    if (H > 30) tops.push({ y: F + H * 0.84, z: m.z, diameter: Math.min(2.6, h.beam * 0.22) });
    mastTops.push({ y: F + H, z: m.z });
    const foreAft = m.sails.map((s, i) => ({ s, i })).filter((x) => x.s.rig === "foreAft");
    const highestFa = Math.max(...foreAft.map((x) => x.s.ceHeight), -Infinity);
    let gaffDone = false;
    m.sails.forEach((s, si) => {
      if (s.rig === "square") {
        for (const t of TIERS) {
          const height = H * (t.to - t.from);
          const width = (s.area * t.share) / height / (1 - 0.06);
          sails.push({ mast: mi, sail: si, shape: "square", width: width * t.widthK + width * (1 - t.widthK) * 0.5, height, foot: F + H * t.from, nodeZ: m.z, nodeY: 0, setFrom: t.setFrom, setSpan: t.setSpan, yard: true, emblem: t.share > 0.3 });
        }
        return;
      }
      if (!gaffDone && s.ceHeight >= highestFa && (mi > 0 || def.masts.length === 1)) {
        gaffDone = true;
        const height = H * 0.5;
        sails.push({ mast: mi, sail: si, shape: "gaff", width: s.area / (height * 0.85), height, foot: F + 1.6, nodeZ: m.z, nodeY: 0, setFrom: 0, setSpan: 1, yard: true, emblem: false });
        return;
      }
      // Head sails: a jib from the foremast head to the bowsprit, and a spritsail below it.
      const width = Math.max(4, bowspritEnd.z - m.z);
      const height = Math.min(H * 0.7, F + H * 0.75 - bowspritEnd.y);
      sails.push({ mast: mi, sail: si, shape: "jib", width, height, foot: 0, nodeZ: bowspritEnd.z, nodeY: bowspritEnd.y, setFrom: 0, setSpan: 1, yard: false, emblem: false });
      if (mi === 0) {
        const sw = h.beam * 0.9;
        sails.push({ mast: mi, sail: si, shape: "square", width: sw, height: sw * 0.45, foot: base - sw * 0.45 + Math.sin(BOWSPRIT_ANGLE) * bsLen * 0.6 - 0.4, nodeZ: h.length / 2 - 1 + Math.cos(BOWSPRIT_ANGLE) * bsLen * 0.6, nodeY: 0, setFrom: 0.2, setSpan: 0.4, yard: true, emblem: false });
      }
    });
  });
  return { spars, tops, sails, bowspritEnd, mastTops };
};
