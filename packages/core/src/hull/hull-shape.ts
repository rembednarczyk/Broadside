import { clamp } from "../math/scalar";

/**
 * Parametric hull lines. One shape serves three users (ADR-0005): the buoyancy sample points, the
 * mass and inertia, and the render mesh (engine lofts the same half-breadths). Body space: origin
 * at the design waterline, midships, centreline; +Z to the bow, +Y up, +X to starboard.
 */
export interface HullShape {
  readonly length: number;
  readonly beam: number;
  /** Depth of the keel below the design waterline. */
  readonly draft: number;
  /** Height of the deck above the design waterline (at midships). */
  readonly freeboard: number;
  /** Larger is a sharper bow entrance (exponent of the plan form). */
  readonly bowFineness: number;
  /** Larger is a fuller stern run. */
  readonly sternFineness: number;
  /** Width of the transom as a share of the beam. */
  readonly transom: number;
  /** Section fullness: 1 is a V section, 3 is a round bilge. */
  readonly bilge: number;
  /** Rise of the deck towards bow and stern (sheer), metres. */
  readonly sheer: number;
}

/** u in [0, 1] from stern to bow. */
export const stationZ = (h: HullShape, u: number): number => (u - 0.5) * h.length;

/** Plan form: share of the half-beam at a station (0 at the stem, `transom` at the stern). */
export const planWidth = (h: HullShape, u: number): number => {
  const mid = 0.46;
  if (u >= mid) {
    const t = clamp((u - mid) / (1 - mid), 0, 1);
    return Math.pow(1 - Math.pow(t, h.bowFineness), 0.5);
  }
  const t = clamp((mid - u) / mid, 0, 1);
  return h.transom + (1 - h.transom) * Math.pow(1 - Math.pow(t, h.sternFineness), 0.5);
};

/** Keel line: depth below the waterline at a station (the forefoot and heel rise). */
export const keelDepth = (h: HullShape, u: number): number => {
  const bow = clamp((u - 0.8) / 0.2, 0, 1);
  const stern = clamp((0.08 - u) / 0.08, 0, 1);
  return h.draft * (1 - 0.85 * bow * bow - 0.3 * stern);
};

/** Deck height above the waterline at a station (sheer line). */
export const deckHeight = (h: HullShape, u: number): number => {
  const t = (u - 0.5) * 2;
  return h.freeboard + h.sheer * t * t * (t > 0 ? 1 : 0.7);
};

/**
 * Half-breadth (metres) at station u and height y in body space. Zero below the keel and above the
 * deck. The section narrows from the waterline to the keel with the bilge exponent and has a
 * little tumblehome above the waterline.
 */
export const halfBreadth = (h: HullShape, u: number, y: number): number => {
  const keel = -keelDepth(h, u);
  const deck = deckHeight(h, u);
  if (y < keel || y > deck) return 0;
  const full = (h.beam / 2) * planWidth(h, u);
  if (y >= 0) {
    const t = deck > 0 ? y / deck : 0;
    return full * (1 - 0.1 * t * t);
  }
  const t = keel < 0 ? 1 - y / keel : 1;
  return full * (1 - Math.pow(1 - clamp(t, 0, 1), h.bilge));
};
