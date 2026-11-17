import { type Vec3, vec3 } from "./vec3";

/** Unit quaternion (x, y, z, w) for body orientation. Pure operations. */
export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

export const quatFromAxisAngle = (axis: Vec3, angle: number): Quat => {
  const s = Math.sin(angle / 2);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) };
};

/** Heading around +Y; 0 means the bow points to +Z, positive turns the bow towards +X. */
export const quatFromYaw = (yaw: number): Quat => quatFromAxisAngle(vec3(0, 1, 0), yaw);

export const quatMul = (a: Quat, b: Quat): Quat => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});

export const quatConj = (q: Quat): Quat => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

export const quatNormalize = (q: Quat): Quat => {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
};

/** Rotates a vector from body space to world space. */
export const rotate = (q: Quat, v: Vec3): Vec3 => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return vec3(v.x + q.w * tx + (q.y * tz - q.z * ty), v.y + q.w * ty + (q.z * tx - q.x * tz), v.z + q.w * tz + (q.x * ty - q.y * tx));
};

/** Rotates a vector from world space to body space. */
export const rotateInv = (q: Quat, v: Vec3): Vec3 => rotate(quatConj(q), v);

/** Integrates a world-space angular velocity over dt (first order, renormalised). */
export const integrateQuat = (q: Quat, omega: Vec3, dt: number): Quat => {
  const dq = quatMul({ x: omega.x, y: omega.y, z: omega.z, w: 0 }, q);
  return quatNormalize({ x: q.x + 0.5 * dt * dq.x, y: q.y + 0.5 * dt * dq.y, z: q.z + 0.5 * dt * dq.z, w: q.w + 0.5 * dt * dq.w });
};

/** Heading of the body's bow projected on the water plane. */
export const yawOf = (q: Quat): number => {
  const f = rotate(q, vec3(0, 0, 1));
  return Math.atan2(f.x, f.z);
};

/** Heel angle (roll around the bow axis); positive means the starboard (+X) side is down. */
export const rollOf = (q: Quat): number => {
  const right = rotate(q, vec3(1, 0, 0));
  return -Math.asin(Math.max(-1, Math.min(1, right.y)));
};

/** Trim angle (pitch); positive means the bow is up. */
export const pitchOf = (q: Quat): number => {
  const f = rotate(q, vec3(0, 0, 1));
  return Math.asin(Math.max(-1, Math.min(1, f.y)));
};
