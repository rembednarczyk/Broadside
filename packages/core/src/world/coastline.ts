import { type Island, islandHeight } from "./archipelago";

/**
 * An island's contour as a closed polygon for the sea chart: along `n` rays from the island's
 * centre, the distance where the terrain (islandHeight, the simulation's own) crosses `level`,
 * found by bisection (a marching-rays contour: one crossing per ray, the outermost, so an inlet
 * that folds back on a ray is drawn closed; a chart's scale hides it). Level 0 is the waterline,
 * a negative level the edge of the shallows. World coordinates, in the order of the angle.
 */
export const coastline = (is: Island, n = 48, level = 0): { x: number; z: number }[] => {
  const out: { x: number; z: number }[] = [];
  const reach = is.radius * 1.4 + is.shoal * 1.2 + 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const above = (r: number): boolean => islandHeight(is, is.x + dx * r, is.z + dz * r) > level;
    // The outermost crossing: walk in from the reach to the first point above the level, then bisect.
    let lo = 0;
    let hi = reach;
    for (let r = reach; r > 0; r -= 10) {
      if (above(r)) {
        lo = r;
        hi = Math.min(reach, r + 10);
        break;
      }
    }
    for (let k = 0; k < 12; k++) {
      const m = (lo + hi) / 2;
      if (above(m)) lo = m;
      else hi = m;
    }
    const r = (lo + hi) / 2;
    out.push({ x: is.x + dx * r, z: is.z + dz * r });
  }
  return out;
};
