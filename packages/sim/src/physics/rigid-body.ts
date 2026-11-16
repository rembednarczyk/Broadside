import {
  type Quat,
  type Vec3,
  ZERO,
  add,
  addScaled,
  cross,
  integrateQuat,
  rotate,
  rotateInv,
  scale,
  sub,
  vec3,
  mulv,
} from "@broadside/core";

/**
 * Rigid body with six degrees of freedom, integrated with semi-implicit (symplectic) Euler on the
 * fixed step (G. Fiedler, "Integration Basics" and "Fix Your Timestep!"). Forces are accumulated
 * during a step and cleared by `integrate`. The diagonal inertia tensor is in body space; the
 * world-space angular velocity is updated through I_world^-1 = R I_body^-1 R^T.
 */
export interface RigidBody {
  /** Centre of mass in world space. */
  pos: Vec3;
  vel: Vec3;
  rot: Quat;
  /** World-space angular velocity (rad/s). */
  angVel: Vec3;
  readonly mass: number;
  /** Diagonal of the body-space inertia tensor (kg m^2). */
  readonly inertia: Vec3;
  force: Vec3;
  torque: Vec3;
}

export const createBody = (mass: number, inertia: Vec3, pos: Vec3, rot: Quat): RigidBody => ({
  pos,
  vel: ZERO,
  rot,
  angVel: ZERO,
  mass,
  inertia,
  force: ZERO,
  torque: ZERO,
});

/** Body-space offset from the centre of mass to world space. */
export const bodyToWorld = (b: RigidBody, local: Vec3): Vec3 => add(b.pos, rotate(b.rot, local));

/** Velocity of a world-space point attached to the body. */
export const pointVelocity = (b: RigidBody, worldPoint: Vec3): Vec3 => add(b.vel, cross(b.angVel, sub(worldPoint, b.pos)));

export const applyForce = (b: RigidBody, f: Vec3): void => {
  b.force = add(b.force, f);
};

/** A force at a world-space point: adds the force and its moment about the centre of mass. */
export const applyForceAt = (b: RigidBody, f: Vec3, worldPoint: Vec3): void => {
  b.force = add(b.force, f);
  b.torque = add(b.torque, cross(sub(worldPoint, b.pos), f));
};

export const applyTorque = (b: RigidBody, t: Vec3): void => {
  b.torque = add(b.torque, t);
};

const invInertia = (b: RigidBody): Vec3 => vec3(1 / b.inertia.x, 1 / b.inertia.y, 1 / b.inertia.z);

export const integrate = (b: RigidBody, dt: number): void => {
  b.vel = addScaled(b.vel, b.force, dt / b.mass);
  // Angular: torque into body space, scale by I^-1, back to world.
  const localTorque = rotateInv(b.rot, b.torque);
  const localAcc = mulv(localTorque, invInertia(b));
  b.angVel = addScaled(b.angVel, rotate(b.rot, localAcc), dt);
  b.pos = addScaled(b.pos, b.vel, dt);
  b.rot = integrateQuat(b.rot, b.angVel, dt);
  b.force = ZERO;
  b.torque = ZERO;
};

/** Applies an instantaneous impulse at a world point (collisions, ramming). */
export const applyImpulseAt = (b: RigidBody, impulse: Vec3, worldPoint: Vec3): void => {
  b.vel = addScaled(b.vel, impulse, 1 / b.mass);
  const local = rotateInv(b.rot, cross(sub(worldPoint, b.pos), impulse));
  b.angVel = add(b.angVel, rotate(b.rot, mulv(local, invInertia(b))));
};

export const kineticEnergy = (b: RigidBody): number => {
  const w = rotateInv(b.rot, b.angVel);
  return 0.5 * b.mass * (b.vel.x ** 2 + b.vel.y ** 2 + b.vel.z ** 2) + 0.5 * (b.inertia.x * w.x ** 2 + b.inertia.y * w.y ** 2 + b.inertia.z * w.z ** 2);
};

export const GRAVITY_VEC = scale(vec3(0, -1, 0), 9.81);
