import { type Vec3, WATER_DENSITY, clamp, rotate, rotateInv, vec3, waterHeight, DEG, refit } from "@broadside/core";
import { type System } from "./context";
import { type RigidBody, GRAVITY_VEC, applyForce, applyForceAt, bodyToWorld, pointVelocity } from "../physics/rigid-body";
import { type ShipState, crewShare } from "../ship/ship-state";
import { type GerstnerWave } from "@broadside/core";

/**
 * Hydrostatics and hydrodynamics on the hull samples: buoyancy rho g V_submerged per sample, and
 * anisotropic quadratic drag (a keel resists sideways and vertical motion far more than forward
 * motion). Forward drag grows past hull speed (wave-making resistance by Froude number). The
 * rudder is a foil at the stern; oars push along the keel.
 */
const G = 9.81;
const C_FORWARD = 0.065;
const C_SIDE = 1.1;
const C_BOTTOM = 1.4;
/** Small linear damping so slow drift and roll settle (skin friction at low speed). */
const LINEAR_DAMPING = 0.04;
const RUDDER_MAX = 35 * DEG;
/** Game scale on the rudder: real ships turn in 3 hull lengths; the game wants about 1.5-2. */
const RUDDER_GAIN = 2.2;

const waveMultiplier = (speed: number, length: number): number => {
  const fn = Math.abs(speed) / Math.sqrt(G * length);
  const over = Math.max(0, fn - 0.3);
  return 1 + 45 * over * over;
};

const hullForces = (b: RigidBody, s: ShipState, waves: readonly GerstnerWave[], t: number, far: boolean): void => {
  const fwd = rotateInv(b.rot, b.vel).z;
  const waveMul = waveMultiplier(fwd, s.model.def.hull.length);
  const drag = refit(s.upgrades, "drag");
  for (const smp of far ? s.model.samplesFar : s.model.samples) {
    const wp = bodyToWorld(b, smp.p);
    const wy = waterHeight(waves, wp.x, wp.z, t);
    const f = clamp((wy - (wp.y - smp.height / 2)) / smp.height, 0, 1);
    if (f <= 0) continue;
    applyForceAt(b, vec3(0, WATER_DENSITY * G * smp.volume * f, 0), wp);
    const v = rotateInv(b.rot, pointVelocity(b, wp));
    const k = 0.5 * WATER_DENSITY * f;
    const local = vec3(
      -k * C_SIDE * smp.areaSide * Math.abs(v.x) * v.x - LINEAR_DAMPING * k * smp.areaSide * v.x * 10,
      -k * C_BOTTOM * smp.areaBottom * Math.abs(v.y) * v.y - LINEAR_DAMPING * k * smp.areaBottom * v.y * 10,
      -k * C_FORWARD * waveMul * drag * smp.areaFront * Math.abs(v.z) * v.z - LINEAR_DAMPING * k * smp.areaFront * v.z,
    );
    applyForceAt(b, rotate(b.rot, local), wp);
  }
};

const rudderLift = (alpha: number): number => {
  const a = clamp(alpha, -0.9, 0.9);
  const stall = Math.abs(a) > RUDDER_MAX ? 0.6 : 1;
  return clamp(2 * Math.PI * 0.55 * a, -1.15, 1.15) * stall;
};

const rudderForce = (b: RigidBody, s: ShipState): void => {
  const p = bodyToWorld(b, s.model.rudder);
  const v = rotateInv(b.rot, pointVelocity(b, p));
  const flow = Math.max(Math.abs(v.z), 0.5);
  const alpha = s.rudder * RUDDER_MAX * Math.sign(v.z || 1) + Math.atan2(v.x, flow);
  const q = 0.5 * WATER_DENSITY * (v.z * v.z + v.x * v.x);
  const fx = -q * s.model.def.rudderArea * RUDDER_GAIN * rudderLift(alpha);
  applyForceAt(b, rotate(b.rot, vec3(fx, 0, 0)), p);
};

const oarForce = (b: RigidBody, s: ShipState): void => {
  if (!s.oars || s.model.def.oars <= 0) return;
  const fwd = rotateInv(b.rot, b.vel).z;
  const thrust = s.model.def.oars * Math.min(1, crewShare(s) * 1.25) * clamp(1 - fwd / 4.5, 0, 1);
  applyForce(b, rotate(b.rot, vec3(0, 0, thrust)));
};

/** Water in the hull weighs on its section: a flooded bow trims the ship by the head. */
const floodWeight = (b: RigidBody, s: ShipState): void => {
  const h = s.model.def.hull;
  s.sections.forEach((sec, i) => {
    if (sec.water <= 0) return;
    const zone = Math.floor(i / 2);
    const local: Vec3 = vec3((i % 2 === 1 ? 1 : -1) * h.beam * 0.2, -h.draft * 0.5 - s.model.com.y, h.length * (0.3 - zone * 0.3));
    applyForceAt(b, vec3(0, -WATER_DENSITY * G * sec.water, 0), bodyToWorld(b, local));
  });
};

/** Ships farther than this from the player float on the coarse samples (LOD of the physics). */
const FAR = 700;

export const hydroSystem: System = (ctx) => {
  let px = 0;
  let pz = 0;
  let hasPlayer = false;
  for (const p of ctx.world.with("player", "body")) {
    px = p.body.pos.x;
    pz = p.body.pos.z;
    hasPlayer = true;
  }
  for (const e of ctx.world.with("ship", "body")) {
    const b = e.body;
    const s = e.ship;
    applyForce(b, vec3(GRAVITY_VEC.x * b.mass, GRAVITY_VEC.y * b.mass, GRAVITY_VEC.z * b.mass));
    const far = hasPlayer && !e.player && Math.hypot(b.pos.x - px, b.pos.z - pz) > FAR;
    hullForces(b, s, ctx.env.waves, ctx.env.time, far);
    rudderForce(b, s);
    oarForce(b, s);
    floodWeight(b, s);
  }
};
