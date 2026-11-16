import { type Vec3, vec3 } from "../math/vec3";
import { type HullShape, deckHeight, halfBreadth, keelDepth, stationZ } from "./hull-shape";

/**
 * Hull as a cloud of volume samples (a voxel-like discretisation, as in Kerner, "Water interaction
 * model for boats in video games", Gamasutra 2015): each sample stands for a small prism of the hull
 * and knows its volume. Buoyancy adds rho g V for the submerged part of each prism.
 */
export interface HullSample {
  /** Centre of the prism in body space. */
  readonly p: Vec3;
  readonly volume: number;
  /** Vertical extent of the prism: its submerged share comes from the water height. */
  readonly height: number;
  /** Projected areas used by hydrodynamic drag (side, front, bottom). */
  readonly areaSide: number;
  readonly areaFront: number;
  readonly areaBottom: number;
}

export interface HullModel {
  readonly samples: readonly HullSample[];
  /** Volume under the design waterline: times water density, the ship's displacement. */
  readonly designVolume: number;
  readonly totalVolume: number;
}

export interface HullGrid {
  readonly stations: number;
  readonly layers: number;
  readonly across: number;
}

export const DEFAULT_GRID: HullGrid = { stations: 10, layers: 4, across: 2 };

export const WATER_DENSITY = 1025;

export const buildHullModel = (h: HullShape, grid: HullGrid = DEFAULT_GRID): HullModel => {
  const samples: HullSample[] = [];
  const dz = h.length / grid.stations;
  let designVolume = 0;
  for (let s = 0; s < grid.stations; s++) {
    const u = (s + 0.5) / grid.stations;
    const keel = -keelDepth(h, u);
    const deck = deckHeight(h, u);
    const dy = (deck - keel) / grid.layers;
    for (let l = 0; l < grid.layers; l++) {
      const y = keel + (l + 0.5) * dy;
      const hb = halfBreadth(h, u, y);
      if (hb <= 0.01) continue;
      const width = (2 * hb) / grid.across;
      for (let a = 0; a < grid.across; a++) {
        const x = -hb + (a + 0.5) * width;
        const volume = width * dy * dz;
        // Areas are shares of the hull's projected areas: summed over the samples, the side area
        // counts each column once (divide by across), the front each station row once (by stations)
        // and the bottom each layer once (by layers).
        samples.push({
          p: vec3(x, y, stationZ(h, u)),
          volume,
          height: dy,
          areaSide: (dy * dz) / grid.across,
          areaFront: (width * dy) / grid.stations,
          areaBottom: (width * dz) / grid.layers,
        });
        const below = Math.min(1, Math.max(0, (0 - (y - dy / 2)) / dy));
        designVolume += volume * below;
      }
    }
  }
  const totalVolume = samples.reduce((sum, s) => sum + s.volume, 0);
  return { samples, designVolume, totalVolume };
};
