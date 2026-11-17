/**
 * The cinematic camera's eye (pure, tested): a lens riding the swell a metre or two above the
 * water, slowly circling the ship, as the reference's tracking shots are filmed (a camera boat or
 * a float: the eye rises and falls with the long waves and lags on the steep ones, so the short
 * chop now and then washes over the lens), and every `DIP_PERIOD` seconds sinks through the
 * surface for a moment and comes up wet (the reference's passes from above to below the water,
 * ref_160 to ref_170). Exponential smoothing of the height (1 - exp(-k dt), frame-rate independent),
 * the same filter as the follow camera.
 */
export const DIP_PERIOD = 45;
/** How fast the float follows the surface (1/s): slow enough to lag on short waves. */
const RIDE = 2.5;
/** Orbit rate (rad/s): once round the ship in about two minutes. */
export const ORBIT_RATE = 0.05;

/** Height of the lens over the water it rides at time `t`: about 1.3 m, under it during a dip. */
export const clearance = (t: number): number => 1.3 + 0.4 * Math.sin(0.5 * t) - 2.6 * Math.pow(Math.abs(Math.sin((Math.PI * t) / DIP_PERIOD)), 96);

/** Distance from the ship: under two lengths, within what frames her whole from the waterline. */
export const orbitRadius = (length: number): number => Math.min(90, Math.max(26, length * 1.8));

export interface CineState {
  /** Angle round the ship (radians), time in the mode (s), height of the eye (m). */
  angle: number;
  t: number;
  y: number;
  /** How far the lens has turned up to the surface (0: at the ship, 1: up), smoothed. */
  tilt?: number;
}

/**
 * Under the water the lens turns up to the bright window of the surface over it (ref_158 to
 * ref_165: the sun through the waves), and back to the ship once it is out; returns how far up
 * (0 to 1), easing at TILT_RATE so the turn is a camera operator's, not a cut.
 */
const TILT_RATE = 1.6;
export const tiltStep = (s: CineState, depth: number, dt: number): number => {
  const want = depth > 0.15 ? 1 : 0;
  s.tilt = (s.tilt ?? 0) + (want - (s.tilt ?? 0)) * (1 - Math.exp(-TILT_RATE * dt));
  return s.tilt;
};

/** Advances the eye by `dt` round a ship at (x, z) of `length`; `surface(x, z)` is the sea's height. */
export const rideStep = (s: CineState, ship: { x: number; z: number; length: number }, surface: (x: number, z: number) => number, dt: number): { x: number; y: number; z: number } => {
  s.t += dt;
  s.angle += ORBIT_RATE * dt;
  const r = orbitRadius(ship.length);
  const x = ship.x + r * Math.cos(s.angle);
  const z = ship.z + r * Math.sin(s.angle);
  const want = surface(x, z) + clearance(s.t);
  s.y += (want - s.y) * (1 - Math.exp(-RIDE * dt));
  return { x, y: s.y, z };
};
