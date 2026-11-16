import { approach, clamp, rotateInv, wrapAngle, yawOf } from "@broadside/core";
import { type System } from "./context";
import { type ShipState, crewShare } from "../ship/ship-state";
import { type RigidBody } from "../physics/rigid-body";

/**
 * The helmsman. With a course set, a PID controller picks the rudder (proportional on the heading
 * error, integral against the steady weather helm, derivative on the yaw rate; the usual autopilot
 * law, with the integral clamped against windup); otherwise the commanded rudder is used. The wheel turns at a limited rate: hard over takes about two seconds.
 */
const RUDDER_RATE = 0.6;
const KP = 2.2;
const KD = 5;
const KI = 0.5;
const I_LIMIT = 0.6;

const steer = (s: ShipState, b: RigidBody, dt: number): number => {
  if (s.course === null) {
    s.courseIntegral = 0;
    return s.rudderTarget;
  }
  const err = wrapAngle(s.course - yawOf(b.rot));
  // Integrate only near the course: while turning the error is large and transient.
  if (Math.abs(err) < 0.35) s.courseIntegral = clamp(s.courseIntegral + KI * err * dt, -I_LIMIT, I_LIMIT);
  const yawRate = b.angVel.y;
  // Going astern the rudder acts the other way.
  const dir = rotateInv(b.rot, b.vel).z >= -0.2 ? 1 : -1;
  return clamp((KP * err - KD * yawRate + s.courseIntegral) * dir, -1, 1);
};

export const helmSystem: System = (ctx, dt) => {
  for (const e of ctx.world.with("ship", "body")) {
    const s = e.ship;
    if (s.sinking) continue;
    const sternIntact = s.sections[4]!.hp > 0 || s.sections[5]!.hp > 0;
    const rate = RUDDER_RATE * (sternIntact ? 1 : 0.3) * Math.max(0.3, crewShare(s));
    s.rudder = approach(s.rudder, steer(s, e.body, dt), rate * dt);
  }
};
