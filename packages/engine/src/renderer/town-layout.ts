import { type Archipelago, type PortSite, createRng, hashString, islandHeight, range } from "@broadside/core";

/**
 * A harbour town behind each port: houses scattered up the slope behind the quay on gentle
 * ground (deterministic from the port), a pier running out into the water, lanterns along it.
 */
export interface House {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly yaw: number;
}

export interface TownLayout {
  readonly houses: readonly House[];
  /** Pier from the shore out to sea: start, end, width. */
  readonly pier: { readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number; readonly width: number };
  readonly lanterns: readonly { readonly x: number; readonly y: number; readonly z: number }[];
}

export const townLayout = (a: Archipelago, port: PortSite): TownLayout => {
  const is = a.islands[port.island]!;
  const rng = createRng(hashString(`town-${port.name}-${a.seed}`));
  const inland = Math.atan2(is.x - port.x, is.z - port.z);
  const houses: House[] = [];
  for (let i = 0; i < 160 && houses.length < 26; i++) {
    const a2 = inland + range(rng, -0.9, 0.9);
    const d = range(rng, 25, 110);
    const x = port.x + Math.sin(a2) * d;
    const z = port.z + Math.cos(a2) * d;
    const y = islandHeight(is, x, z);
    const slope = Math.abs(islandHeight(is, x + 3, z) - y) + Math.abs(islandHeight(is, x, z + 3) - y);
    if (y < 1.5 || y > 30 || slope > 2.5) continue;
    if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 9)) continue;
    houses.push({ x, y, z, w: range(rng, 5, 9), d: range(rng, 6, 11), h: range(rng, 3.5, 7), yaw: inland + range(rng, -0.3, 0.3) });
  }
  // The pier runs seaward from the shoreline.
  const out = inland + Math.PI;
  let sx = port.x;
  let sz = port.z;
  for (let r = 0; r < 120; r += 2) {
    const x = port.x + Math.sin(inland) * r;
    const z = port.z + Math.cos(inland) * r;
    if (islandHeight(is, x, z) > 0.5) {
      sx = x;
      sz = z;
      break;
    }
  }
  const pier = { x0: sx, z0: sz, x1: sx + Math.sin(out) * 60, z1: sz + Math.cos(out) * 60, width: 5 };
  const lanterns = [0.25, 0.55, 0.85, 1].map((t) => ({ x: pier.x0 + (pier.x1 - pier.x0) * t, y: 4, z: pier.z0 + (pier.z1 - pier.z0) * t }));
  return { houses, pier, lanterns };
};
