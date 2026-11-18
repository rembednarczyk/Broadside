import { type SailLevel, clamp, wrapAngle, yawOf } from "@broadside/core";
import { STEP, type Simulation } from "@broadside/sim";
import { type TapOrder } from "./controllers/tap-targets";

/** Course change while a helm button is held (rad/s). */
const STEER_RATE = 0.45;

/**
 * How the player steers, apart from the rest of the session (single responsibility): the classic
 * helm (a held button turns the course at STEER_RATE, the helmsman holds it) and simple steering
 * (routes and orders the crew carries out, sim/ai/pilot). Everything reaches the simulation as
 * commands (Command pattern), so a game replays the same from its command log.
 */
export class PlayerHelm {
  private steering: -1 | 0 | 1 = 0;

  constructor(private readonly sim: Simulation, private readonly playerId: number, private course: number) {}

  /** Before each simulation step: while a helm button is held, lead the course round. */
  apply(): void {
    if (this.steering === 0) return;
    const p = this.sim.byId(this.playerId);
    if (!p?.body) return;
    // Lead the ship by at most ~0.6 rad so releasing the button settles quickly.
    const heading = yawOf(p.body.rot);
    const next = wrapAngle(this.course + this.steering * STEER_RATE * STEP);
    this.course = wrapAngle(heading + clamp(wrapAngle(next - heading), -0.6, 0.6));
    this.sim.command({ type: "course", ship: this.playerId, heading: this.course });
  }

  /** Classic helm: start or stop turning (-1 to port, 1 to starboard, 0 to hold); takes the wheel from the pilot. */
  steer(direction: -1 | 0 | 1): void {
    if (direction !== 0 && this.steering === 0) {
      const p = this.sim.byId(this.playerId);
      if (p?.body) this.course = yawOf(p.body.rot);
    }
    this.steering = direction;
  }

  /** Simple steering: the crew sails the ship through these points (`hold`: then keeps on). */
  navigate(route: readonly { x: number; z: number }[], hold: boolean): void {
    this.steering = 0;
    this.sim.command({ type: "navigate", ship: this.playerId, route, hold });
  }

  /** Simple steering: the order a tap gave (tap-targets). */
  order(o: TapOrder): void {
    this.steering = 0;
    const ship = this.playerId;
    switch (o.kind) {
      case "stop":
        this.navigate([], false);
        this.sim.command({ type: "sails", ship, mast: "all", level: 0 as SailLevel });
        return;
      case "go":
      case "dock":
        return this.navigate([o.at], false);
      case "board":
      case "follow":
        return this.sim.command({ type: "pilot", ship, order: { kind: o.kind, target: o.target } });
      case "storm":
        return this.sim.command({ type: "pilot", ship, order: { kind: "assault", fort: o.fort } });
    }
  }
}
