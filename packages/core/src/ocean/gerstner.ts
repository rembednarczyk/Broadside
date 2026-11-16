import { type Vec3, vec3 } from "../math/vec3";

/**
 * Sum of Gerstner (trochoidal) waves, after Tessendorf "Simulating Ocean Water" and GPU Gems 1,
 * ch. 1 (Finch). One wave set drives both the simulation (buoyancy, ballistics splash) and the
 * ocean shader: the engine uploads the same numbers as uniforms (`packWaves`), so a hull floats on
 * exactly the surface the player sees (ADR-0004).
 */
export interface GerstnerWave {
  /** Unit direction of travel on the water plane. */
  readonly dirX: number;
  readonly dirZ: number;
  /** Wave number 2PI / wavelength. */
  readonly k: number;
  /** Angular frequency (deep water dispersion: sqrt(g k)). */
  readonly omega: number;
  /** Vertical amplitude in metres. */
  readonly amplitude: number;
  /** Horizontal displacement amplitude (steepness Q times amplitude). */
  readonly qa: number;
  readonly phase: number;
}

export const GRAVITY = 9.81;
/** Shader uniform arrays have a fixed size; a wave set never holds more. */
export const MAX_WAVES = 8;

export const makeWave = (dirAngle: number, wavelength: number, amplitude: number, steepness: number, phase: number, count: number): GerstnerWave => {
  const k = (Math.PI * 2) / wavelength;
  const s = Math.min(1, steepness);
  // Orbit at most circular (qa <= s A) and the sum loop-free (sum of k qa <= s), GPU Gems 1 eq. 9.
  const qa = Math.min(s * amplitude, s / (k * count));
  return { dirX: Math.sin(dirAngle), dirZ: Math.cos(dirAngle), k, omega: Math.sqrt(GRAVITY * k), amplitude, qa, phase };
};

/** Displacement of the surface point that rests at (x0, z0) when the sea is flat. */
export const displacement = (waves: readonly GerstnerWave[], x0: number, z0: number, t: number): Vec3 => {
  let dx = 0;
  let dy = 0;
  let dz = 0;
  for (const w of waves) {
    const th = w.k * (w.dirX * x0 + w.dirZ * z0) - w.omega * t + w.phase;
    const c = Math.cos(th);
    dx += w.qa * w.dirX * c;
    dz += w.qa * w.dirZ * c;
    dy += w.amplitude * Math.sin(th);
  }
  return vec3(dx, dy, dz);
};

/**
 * Water height at a world point. Gerstner waves move points sideways, so the rest position under
 * (x, z) is found by fixed-point iteration (converges in a few steps while steepness < 1).
 */
export const waterHeight = (waves: readonly GerstnerWave[], x: number, z: number, t: number): number => {
  let x0 = x;
  let z0 = z;
  for (let i = 0; i < 4; i++) {
    const d = displacement(waves, x0, z0, t);
    x0 = x - d.x;
    z0 = z - d.z;
  }
  return displacement(waves, x0, z0, t).y;
};

/** Surface normal near a world point (central differences on waterHeight). */
export const waterNormal = (waves: readonly GerstnerWave[], x: number, z: number, t: number, eps = 0.5): Vec3 => {
  const hx = waterHeight(waves, x + eps, z, t) - waterHeight(waves, x - eps, z, t);
  const hz = waterHeight(waves, x, z + eps, t) - waterHeight(waves, x, z - eps, t);
  const nx = -hx / (2 * eps);
  const nz = -hz / (2 * eps);
  const l = Math.hypot(nx, 1, nz);
  return vec3(nx / l, 1 / l, nz / l);
};

/** Vertical speed of the water surface at a point (for hydrodynamic damping and splash). */
export const waterVerticalSpeed = (waves: readonly GerstnerWave[], x: number, z: number, t: number, dt = 1 / 30): number =>
  (waterHeight(waves, x, z, t + dt) - waterHeight(waves, x, z, t - dt)) / (2 * dt);

/** Uniform layout for the shader: per wave vec4(dirX, dirZ, k, omega) and vec4(amplitude, qa, phase, 0). */
export const packWaves = (waves: readonly GerstnerWave[]): { a: Float32Array; b: Float32Array; count: number } => {
  const a = new Float32Array(MAX_WAVES * 4);
  const b = new Float32Array(MAX_WAVES * 4);
  waves.slice(0, MAX_WAVES).forEach((w, i) => {
    a.set([w.dirX, w.dirZ, w.k, w.omega], i * 4);
    b.set([w.amplitude, w.qa, w.phase, 0], i * 4);
  });
  return { a, b, count: Math.min(waves.length, MAX_WAVES) };
};
