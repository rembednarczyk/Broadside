import { type ShipModel } from "@broadside/sim";
import { beamAt } from "./hull-stations";

/**
 * Where a ship's guns stand run out (pure layout, shared by the meshes and the parts list): the
 * middle of each barrel in hull space, the way its muzzle points and its length.
 */
export interface GunPlace {
  readonly at: readonly [number, number, number];
  readonly dir: readonly [number, number, number];
  readonly length: number;
}

/** Barrel length (m) for a calibre: about 1.4 m for a 4-pounder, 2.9 m for a 32-pounder. */
export const barrelLength = (pounder: number): number => 1.1 + 0.32 * Math.sqrt(pounder);
/** Height of a gun's bore above its mount point: on a carriage, and a swivel on its rail stanchion. */
export const gunHeight = (kind: string): number => (kind === "swivel" ? 0.75 : 0.45);
/** How far the muzzle stands out of the side when run out (m). */
export const PROUD = 0.45;

/**
 * Broadside guns and swivels sit at the ship's side where the hull really is at their station:
 * `halfAt(gun index, z)` gives the half-breadth there (a modelled hull's own side), else the
 * generated hull's is taken.
 */
export const gunPlaces = (model: ShipModel, halfAt: ((gun: number, z: number) => number | null) | null = null): GunPlace[] =>
  model.guns.map((m, gi) => {
    const z = m.pos.z + model.com.z;
    const length = m.kind === "mortar" ? 1.1 : m.kind === "swivel" ? 0.95 : barrelLength(m.pounder);
    const n = Math.hypot(0.75, 0.66);
    const dir: [number, number, number] = m.kind === "mortar" ? [0, 0.75 / n, 0.66 / n] : [m.dir.x, m.dir.y, m.dir.z];
    let x = m.pos.x + model.com.x;
    if (m.side !== "centre") x = Math.sign(m.dir.x) * (Math.max(0.4, halfAt?.(gi, z) ?? beamAt(model.def.hull, z)) + PROUD - length / 2);
    return { at: [x, m.pos.y + model.com.y + gunHeight(m.kind), z], dir, length };
  });
