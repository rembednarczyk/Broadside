import { DEG, clamp } from "../math/scalar";

/**
 * Sail aerodynamics as a thin cambered wing in the horizontal plane (lift/drag polar, after
 * C. A. Marchaj, "Sail Performance", 2003, fig. 2.10 and 3.29, coarsened). Square sails have a
 * lower maximum lift, stall later and drag more than fore-and-aft sails, which is why a square
 * rig cannot point as high but runs well downwind.
 */
export type RigType = "square" | "foreAft";

export interface SailPolar {
  readonly clMax: number;
  /** Angle of attack of the maximum lift. */
  readonly alphaMax: number;
  readonly cd0: number;
  readonly cd90: number;
  /** Sail chord angles from the bow axis the yards or booms can reach (radians, both tacks). */
  readonly chordMin: number;
  readonly chordMax: number;
}

export const POLARS: Readonly<Record<RigType, SailPolar>> = {
  // Square sail on a yard: squared at 90 deg, braced up to about 35 deg from athwartships.
  square: { clMax: 1.05, alphaMax: 32 * DEG, cd0: 0.14, cd90: 1.3, chordMin: 55 * DEG, chordMax: 125 * DEG },
  // Gaff, staysails, jibs: the boom swings from the centreline out to about 80 deg.
  foreAft: { clMax: 1.35, alphaMax: 24 * DEG, cd0: 0.08, cd90: 1.2, chordMin: -80 * DEG, chordMax: 80 * DEG },
};

/** Lift coefficient for an angle of attack in [0, PI/2]; a sail luffs below 2 deg. */
export const liftCoefficient = (p: SailPolar, alpha: number): number => {
  const a = Math.abs(alpha);
  if (a < 2 * DEG) return 0;
  if (a <= p.alphaMax) return p.clMax * Math.sin((Math.PI / 2) * (a / p.alphaMax));
  // Post-stall: lift falls to zero at 90 deg (flat plate behaviour).
  const t = clamp((a - p.alphaMax) / (Math.PI / 2 - p.alphaMax), 0, 1);
  return p.clMax * (1 - 0.35 * t) * Math.cos((Math.PI / 2) * t);
};

export const dragCoefficient = (p: SailPolar, alpha: number): number => {
  const s = Math.sin(Math.abs(alpha));
  return p.cd0 + (p.cd90 - p.cd0) * s * s;
};

export const AIR_DENSITY = 1.225;

export interface SailForce2D {
  /** Force on the water plane in body space: x to starboard, z to the bow (newtons). */
  readonly fx: number;
  readonly fz: number;
  /** The chord angle the crew trimmed to. */
  readonly chord: number;
}

const forceAt = (p: SailPolar, chord: number, ux: number, uz: number, q: number, area: number): { fx: number; fz: number } => {
  const cx = Math.sin(chord);
  const cz = Math.cos(chord);
  // Angle between the flow and the chord line (a line: sign of the chord does not matter).
  const along = Math.abs(ux * cx + uz * cz);
  const alpha = Math.acos(clamp(along, 0, 1));
  // Sail normal pointing to leeward: the side the air pushes.
  let nx = cz;
  let nz = -cx;
  if (nx * ux + nz * uz < 0) {
    nx = -nx;
    nz = -nz;
  }
  // Lift is perpendicular to the flow, on the leeward side of the sail.
  let lx = -uz;
  let lz = ux;
  if (lx * nx + lz * nz < 0) {
    lx = -lx;
    lz = -lz;
  }
  const cl = liftCoefficient(p, alpha);
  const cd = dragCoefficient(p, alpha);
  return { fx: q * area * (cl * lx + cd * ux), fz: q * area * (cl * lz + cd * uz) };
};

/** Number of chord angles the crew tries when trimming: a deterministic search, no solver. */
const TRIM_STEPS = 32;

/**
 * Force of one sail in the apparent wind (body space, m/s, the direction the air moves towards),
 * with the chord trimmed for the best forward drive. `trimSkill` (0..1) blends the best trim with a
 * sloppy one: a short-handed or green crew wastes drive.
 */
export const sailForce = (rig: RigType, area: number, awx: number, awz: number, trimSkill: number): SailForce2D => {
  const p = POLARS[rig];
  const speed = Math.hypot(awx, awz);
  if (speed < 0.05 || area <= 0) return { fx: 0, fz: 0, chord: rig === "square" ? Math.PI / 2 : 0 };
  const ux = awx / speed;
  const uz = awz / speed;
  const q = 0.5 * AIR_DENSITY * speed * speed;
  let best = { fx: 0, fz: -Infinity, chord: p.chordMin };
  let worstFz = Infinity;
  for (let i = 0; i <= TRIM_STEPS; i++) {
    const chord = p.chordMin + ((p.chordMax - p.chordMin) * i) / TRIM_STEPS;
    const f = forceAt(p, chord, ux, uz, q, area);
    if (f.fz > best.fz) best = { ...f, chord };
    worstFz = Math.min(worstFz, f.fz);
  }
  const skill = clamp(trimSkill, 0, 1);
  // Sloppy trim loses drive towards the mean of good and bad; side force stays (it heels anyway).
  const fz = best.fz * (0.55 + 0.45 * skill) + Math.min(0, worstFz) * 0.05 * (1 - skill);
  return { fx: best.fx, fz, chord: best.chord };
};

/** Drive kept by a crew trimming with `trimSkill` (0..1): a green or short-handed crew wastes some. */
const driveShare = (trimSkill: number): number => 0.55 + 0.45 * clamp(trimSkill, 0, 1);

/**
 * Force of one sail held at a given chord angle (the yards where the braces have them, which may
 * lag the best trim while the crew brace round: the yards swing at a rate, not at once). The chord
 * is kept within the rig's reach.
 */
export const sailForceAt = (rig: RigType, area: number, awx: number, awz: number, chord: number, trimSkill: number): SailForce2D => {
  const p = POLARS[rig];
  const c = clamp(chord, p.chordMin, p.chordMax);
  const speed = Math.hypot(awx, awz);
  if (speed < 0.05 || area <= 0) return { fx: 0, fz: 0, chord: c };
  const f = forceAt(p, c, awx / speed, awz / speed, 0.5 * AIR_DENSITY * speed * speed, area);
  return { fx: f.fx, fz: f.fz > 0 ? f.fz * driveShare(trimSkill) : f.fz, chord: c };
};


/**
 * Arc either side of the bow (radians) out of which no square-rigger sails: the wind there backs
 * the canvas. Assisted sailing (the Action and Fun modes, sim systems/assist) drives a ship
 * whatever the wind, even into it; her sails are then shown and trimmed for the wind at the edge
 * of this arc, as when sailing close-hauled (`driveWind`), not filled from ahead (owner's report
 * 22.11: "going ahead with the sails blown the other way").
 */
export const NO_GO = (60 * Math.PI) / 180;

/** Apparent wind (body space, where the air moves to) turned out of the no-go arc, same speed. */
export const driveWind = (awx: number, awz: number): { x: number; z: number } => {
  const speed = Math.hypot(awx, awz);
  if (speed < 1e-6) return { x: awx, z: awz };
  // Where the wind comes from, off the bow (0 dead ahead, + to starboard (+x)).
  const from = Math.atan2(-awx, -awz);
  if (Math.abs(from) >= NO_GO) return { x: awx, z: awz };
  const edge = (from >= 0 ? 1 : -1) * NO_GO;
  return { x: -Math.sin(edge) * speed, z: -Math.cos(edge) * speed };
};
