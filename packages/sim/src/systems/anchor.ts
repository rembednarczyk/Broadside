import { type System } from "./context";
import { applyForce } from "../physics/rigid-body";

/**
 * Riding to an anchor: the cable is a spring once the ship has run out its scope (`SCOPE` metres
 * from the anchor), with the drag of the anchor and the cable on the bottom (a damper on her way
 * through the water) all the time; a quasi-static mooring model (spring-damper, as in simple
 * mooring line models), horizontal only. The ship swings to the wind round the anchor.
 */
const SCOPE = 30;
/** Cable stiffness (N per metre beyond the scope, per kg of ship) and drag (N per m/s, per kg). */
const STIFF = 0.08;
const DRAG = 0.25;

export const anchorSystem: System = (ctx) => {
  for (const e of ctx.world.with("anchor", "ship", "body")) {
    const b = e.body;
    if (e.ship.sinking) continue;
    const dx = b.pos.x - e.anchor.x;
    const dz = b.pos.z - e.anchor.z;
    const d = Math.hypot(dx, dz);
    const stretch = Math.max(0, d - SCOPE);
    const pull = d > 0 ? (STIFF * b.mass * stretch) / d : 0;
    applyForce(b, { x: -dx * pull - DRAG * b.mass * b.vel.x, y: 0, z: -dz * pull - DRAG * b.mass * b.vel.z });
  }
};
