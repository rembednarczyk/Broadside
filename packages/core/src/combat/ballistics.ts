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

/** Distance at which a shot comes down through the aim plane, launched `height` above it (numerical, for the aim table). */
export const flatRange = (speed: number, elevation: number, height: number, k: number, dt = 1 / 60): number => {
  const s: ShotState = { x: 0, y: height, z: 0, vx: 0, vy: Math.sin(elevation) * speed, vz: Math.cos(elevation) * speed };
  for (let i = 0; i < 60 * 60; i++) {
    stepShot(s, k, dt);
    // Down through the aim plane (a launch below it, aiming up at walls, must rise first).
    if (s.y <= 0 && s.vy < 0) return s.z;
  }
  return s.z;
};

/**
 * Elevation that lands a shot at a range over flat water (bisection on the monotone low branch
 * of the range curve, at most `maxElevation`). Returns `maxElevation` when out of range.
 */
export const elevationFor = (range: number, speed: number, height: number, k: number, maxElevation: number): number => {
  let lo = -0.12;
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

/** Kinetic energy of an impact in joules. */
export const impactEnergy = (massKg: number, speed: number): number => 0.5 * massKg * speed * speed;

/** Hit points per joule: a 12-pounder at muzzle speed (about 33 kJ) does about 13 points. */
export const DAMAGE_PER_JOULE = 1 / 2500;
