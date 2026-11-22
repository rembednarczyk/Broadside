import { type Vec3, WATER_DENSITY, clamp, rotate, rotateInv, vec3, waterState, DEG, refit } from "@broadside/core";
import { type System } from "./context";
import { type RigidBody, GRAVITY_VEC, applyForce, applyForceAt, bodyToWorld, pointVelocity } from "../physics/rigid-body";
import { type ShipState, crewShare } from "../ship/ship-state";
import { type GerstnerWave } from "@broadside/core";

/**
 * Hydrostatics and hydrodynamics on the hull samples: buoyancy rho g V_submerged per sample, and
 * anisotropic quadratic drag, vertically on the speed relative to the water's orbital motion
 * (Morison's drag term; a keel resists sideways and vertical motion far more than forward motion). Forward drag grows past hull speed (wave-making resistance by Froude number). The
 * rudder is a foil at the stern; oars push along the keel.
 */
const G = 9.81;
const C_FORWARD = 0.065;
const C_SIDE = 1.1;
const C_BOTTOM = 1.4;
/** Small linear damping so slow drift and roll settle (skin friction at low speed). */
const LINEAR_DAMPING = 0.04;
/**
 * A ship that has struck heaves to (a topsail backed against the others, the helm down) and lies
 * nearly still for the victor to board: her way through the water is checked as by this much more
 * drag ahead. Without it a struck ship under bare poles carried her way 6-9 knots for minutes and
 * could be neither caught nor boarded (beta test 19.11).
 */
const HOVE_TO = 8;
/**
 * Going astern a hull meets the water with her square stern and the rudder blade across the flow:
 * several times the drag of her fine entry ahead. With the same drag both ways a ship in irons
 * made 3-4.5 knots of sternway for over a minute (beta test 19.11); with this, half that.
 */
const ASTERN_DRAG = 4;
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
  const drag = refit(s.upgrades, "drag") * (s.struck && !s.sinking ? HOVE_TO : 1);
  for (const smp of far ? s.model.samplesFar : s.model.samples) {
    const wp = bodyToWorld(b, smp.p);
    // The water there: its surface and how it moves round the sample (the waves' orbits, at the
    // sample's depth below the mean sea level).
    const water = waterState(waves, wp.x, wp.z, t, Math.max(0, -wp.y));
    const wy = water.height;
    const f = clamp((wy - (wp.y - smp.height / 2)) / smp.height, 0, 1);
    if (f <= 0) continue;
    applyForceAt(b, vec3(0, WATER_DENSITY * G * smp.volume * f, 0), wp);
    // Drag on the hull's vertical motion through the water, not against a still sea (the drag
    // term of Morison's equation): a crest rising under the bottom or against the side strikes it,
    // and the hull heaves and pitches with the swell. The horizontal orbits are left out: in full,
    // or at a third, they pushed the ships off their courses (the playtest audit's autopilot
    // stopped finishing its contracts).
    const pv = pointVelocity(b, wp);
    const v = rotateInv(b.rot, vec3(pv.x, pv.y - water.velocity.y, pv.z));
    const k = 0.5 * WATER_DENSITY * f;
    const local = vec3(
      -k * C_SIDE * smp.areaSide * Math.abs(v.x) * v.x - LINEAR_DAMPING * k * smp.areaSide * v.x * 10,
      -k * C_BOTTOM * smp.areaBottom * Math.abs(v.y) * v.y - LINEAR_DAMPING * k * smp.areaBottom * v.y * 10,
      -k * C_FORWARD * waveMul * drag * (v.z < 0 ? ASTERN_DRAG : 1) * smp.areaFront * Math.abs(v.z) * v.z - LINEAR_DAMPING * drag * k * smp.areaFront * v.z,
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
    const local: Vec3 = vec3((i % 2 === 1 ? 1 : -1) * h.beam * 0.2, -h.draft * 0.5 - s.model.com.y, h.length * (0.3 - zone * 0.3) - s.model.com.z);
    applyForceAt(b, vec3(0, -WATER_DENSITY * G * sec.water, 0), bodyToWorld(b, local));
  });
};

/**
 * Ships farther than this from the player float on the coarse samples (LOD of the physics). 700 m
 * until 22.11; 450 m since AI squadrons besiege the forts by the ports (beta test of the forts): a
 * squadron of three lying 450-700 m off the player's port took the soak run over its 2 ms a step
 * (ADR-0005). Beyond 450 m a ship is a few pixels on a phone; the coarse samples still pitch and roll her.
 */
const FAR = 450;

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
