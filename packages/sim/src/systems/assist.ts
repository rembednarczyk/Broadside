import { ASSIST, FUN, assistSpeed, clamp, rotate, rotateInv, vec3 } from "@broadside/core";
import { type System } from "./context";
import { applyForce, applyTorque } from "../physics/rigid-body";
import { type ShipState } from "../ship/ship-state";
import { windAt } from "../environment/environment";

/**
 * Assisted sailing (core/data/assist, the arcade steering mode): the drive and the turn of a ship
 * sailed with the action game's controls, as Reynolds' steering behaviours ("Steering Behaviors
 * For Autonomous Characters", 1999): the steering force is the desired velocity less the present
 * one, truncated to a maximum. Here it acts along her keel only (forward speed) and about her
 * vertical axis (rate of turn), and its target comes from the canvas set and the rudder instead of
 * a seek target. The sails' own drive is left out for these ships (systems/sails keeps the side
 * force for the heel); the hull, the waves, the rudder and the masts' loads work as for any ship.
 */

/** Share of canvas set over all the masts, by sail area (a fallen mast counts as none). */
const canvasSet = (s: ShipState): number => {
  let set = 0;
  let area = 0;
  s.model.masts.forEach((m, i) => {
    const a = m.sails.reduce((t, x) => t + x.area, 0);
    area += a;
    if (s.mastHp[i]! > 0) set += a * s.sailSet[i]!;
  });
  return area > 0 ? set / area : 0;
};

export const assistSystem: System = (ctx) => {
  for (const e of ctx.world.with("assist", "ship", "body")) {
    const s = e.ship;
    const b = e.body;
    if (s.sinking || s.struck) continue;
    const length = s.model.def.hull.length;
    const local = rotateInv(b.rot, b.vel);
    const set = canvasSet(s);
    const w = windAt(ctx.env, 10, b.pos.x, b.pos.z);
    // The Fun mode: an arcade ship's speed, drive and turn (core FUN).
    const fun = !!e.assist.fun;
    const want = e.assist.astern && set < 0.05 ? -ASSIST.astern : assistSpeed(length, set, Math.hypot(w.x, w.z)) * (fun ? FUN.speed : 1);
    const maxAccel = ASSIST.maxAccel * (fun ? FUN.accel : 1);
    // On the bottom the canvas does not drive her further onto the shoal (the assist pushed on at
    // full power and ground a galleon to pieces in seconds, beta test 19.11): no drive ahead, and
    // going astern backs her off (with the kedge, systems/grounding, once she is nearly stopped).
    const ahead = s.aground && want > 0;
    const accel = ahead ? 0 : clamp(ASSIST.gain * (want - local.z), -maxAccel, maxAccel);
    applyForce(b, rotate(b.rot, vec3(0, 0, b.mass * accel)));
    // Rate of turn for the rudder: a circle of turnRadius lengths at her speed; astern the helm acts the other way.
    const dir = local.z >= -0.2 ? 1 : -1;
    const rate = (s.rudder * dir * Math.max(ASSIST.turnSpeed, Math.abs(local.z))) / (ASSIST.turnRadius * (fun ? FUN.turn : 1) * length);
    applyTorque(b, vec3(0, b.inertia.y * ASSIST.yawGain * (rate - b.angVel.y), 0));
  }
};
