/**
 * Wind vectors. A wind direction is the heading the air moves towards (0 = +Z, PI/2 = +X), the
 * same convention as ship headings, so "running before the wind" means heading == wind direction.
 */
export interface Wind2D {
  readonly x: number;
  readonly z: number;
}

export const windVector = (direction: number, speed: number): Wind2D => ({ x: Math.sin(direction) * speed, z: Math.cos(direction) * speed });

/** Apparent wind: true wind minus the ship's own velocity (both on the water plane). */
export const apparentWind = (trueWind: Wind2D, vx: number, vz: number): Wind2D => ({ x: trueWind.x - vx, z: trueWind.z - vz });

/** Beaufort number for a wind speed in m/s (WMO table). */
export const beaufort = (speed: number): number => {
  const limits = [0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  const i = limits.findIndex((l) => speed < l);
  return i === -1 ? 12 : i;
};

/** Point of sail of a heading relative to the wind: 0 = running dead downwind, PI = head to wind. */
export const angleOffWind = (heading: number, windDirection: number): number => {
  let d = Math.abs(heading - windDirection) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};
