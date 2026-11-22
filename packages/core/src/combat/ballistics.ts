import { AIR_DENSITY } from "../sailing/aero";
import { GRAVITY } from "../ocean/gerstner";

/**
 * Exterior ballistics of round shot: gravity and quadratic air drag on a sphere,
 * a = -g - k |v| v with k = rho Cd A / (2 m), Cd = 0.47 (sphere, subsonic); integrated on the
 * fixed step (semi-implicit Euler). Iron shot density 7870 kg/m^3 gives the radius from the mass.
 */
export const IRON_DENSITY = 7870;
export const SPHERE_CD = 0.47;

export const shotRadius = (massKg: number): number => Math.cbrt((3 * massKg) / (4 * Math.PI * IRON_DENSITY));

export const dragFactor = (massKg: number, cd = SPHERE_CD): number => {
  const r = shotRadius(massKg);
  return (AIR_DENSITY * cd * Math.PI * r * r) / (2 * massKg);
};

export interface ShotState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/** One semi-implicit Euler step of a shot in place. */
export const stepShot = (s: ShotState, k: number, dt: number): void => {
  const speed = Math.hypot(s.vx, s.vy, s.vz);
  s.vx -= k * speed * s.vx * dt;
  s.vz -= k * speed * s.vz * dt;
  s.vy -= (GRAVITY + k * speed * s.vy) * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
};

/** Where and when a shot comes down through the aim plane, launched `height` above it (numerical, for the aim tables). */
export const flight = (speed: number, elevation: number, height: number, k: number, dt = 1 / 60): { range: number; time: number } => {
  const s: ShotState = { x: 0, y: height, z: 0, vx: 0, vy: Math.sin(elevation) * speed, vz: Math.cos(elevation) * speed };
  for (let i = 0; i < 60 * 60; i++) {
    stepShot(s, k, dt);
    // Down through the aim plane (a launch below it, aiming up at walls, must rise first).
    if (s.y <= 0 && s.vy < 0) return { range: s.z, time: (i + 1) * dt };
  }
  return { range: s.z, time: 60 };
};

/** Distance at which a shot comes down through the aim plane, launched `height` above it. */
export const flatRange = (speed: number, elevation: number, height: number, k: number, dt = 1 / 60): number => flight(speed, elevation, height, k, dt).range;

/** Lowest elevation of a ship's gun (the port sill); a fort's guns on their platforms depress further. */
export const SHIP_DEPRESSION = -0.12;
export const FORT_DEPRESSION = -0.3;

/**
 * Elevation that lands a shot at a range over flat water (bisection on the monotone low branch
 * of the range curve, between `minElevation` and `maxElevation`). Returns the nearer limit when
 * out of reach. Beta test 22.11: a fort 60 m up a cliff could not lay its guns on a ship under its
 * walls at the ship's depression limit (the shot flew 165–274 m over), so forts lay down to -0.3.
 */
export const elevationFor = (range: number, speed: number, height: number, k: number, maxElevation: number, minElevation = SHIP_DEPRESSION): number => {
  let lo = minElevation;
  let hi = maxElevation;
  if (flatRange(speed, hi, height, k) <= range) return hi;
  if (flatRange(speed, lo, height, k) >= range) return lo;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (flatRange(speed, mid, height, k) < range) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/**
 * Launch speed that lands a shot at a range from a fixed elevation (a mortar sets its range with
 * the powder charge): bisection on speed, range grows with it on the rising branch below 45 deg
 * of the drag curve. Capped at `maxSpeed`.
 */
export const speedFor = (range: number, elevation: number, height: number, k: number, maxSpeed: number): number => {
  let lo = 10;
  let hi = maxSpeed;
  if (flatRange(hi, elevation, height, k) <= range) return hi;
  if (flatRange(lo, elevation, height, k) >= range) return lo;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (flatRange(mid, elevation, height, k) < range) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/** Kinetic energy of an impact in joules. */
export const impactEnergy = (massKg: number, speed: number): number => 0.5 * massKg * speed * speed;

/**
 * Hit points per joule: a 12-pounder at muzzle speed (about 33 kJ) does about 55 points. Tuned by
 * the AI battle audit (battles.audit.ts) so a duel of equals is decided in minutes, not hours.
 */
export const DAMAGE_PER_JOULE = 1 / 600;
