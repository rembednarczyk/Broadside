import { type GameCommand, type SailLevel, clamp, wrapAngle, yawOf } from "@broadside/core";
import { STEP, Simulation } from "@broadside/sim";

/**
 * The game loop without a browser (SpinalTap's GameSession, split by ADR-0031): fixed-step
 * accumulation (Fiedler, "Fix Your Timestep!"), and the translation of player intents into
 * simulation commands. Rendering and DOM live outside; tests drive this class directly.
 */
export interface SessionOptions {
  readonly seed: number;
}

/** Course change while a helm button is held (rad/s). */
const STEER_RATE = 0.45;
/** At most this many steps per frame, so a long stall does not spiral (Fiedler). */
const MAX_STEPS = 8;

export class GameSession {
  readonly sim: Simulation;
  readonly playerId: number;
  private accumulator = 0;
  private steering: -1 | 0 | 1 = 0;
  private course: number;

  constructor(opts: SessionOptions) {
    this.sim = new Simulation({ seed: opts.seed, windDirection: 1.1, windSpeed: 8 });
    const player = this.sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0.2, player: true, speed: 3 });
    this.playerId = player.id;
    this.course = 0.2;
    this.send({ type: "course", ship: this.playerId, heading: this.course });
    this.sim.spawnShip({ classId: "frigate", faction: "crown", x: 260, z: 340, heading: 2.6, speed: 3 });
    this.sim.spawnShip({ classId: "schooner", faction: "pirates", x: -320, z: 180, heading: 1.2, speed: 3 });
  }

  private send(cmd: GameCommand): void {
    this.sim.command(cmd);
  }

  /** Advances the simulation by real elapsed seconds; returns the number of steps taken. */
  advance(seconds: number): number {
    this.accumulator = Math.min(this.accumulator + Math.max(0, seconds), STEP * MAX_STEPS);
    let n = 0;
    while (this.accumulator >= STEP) {
      this.applySteering();
      this.sim.step();
      this.accumulator -= STEP;
      n++;
    }
    return n;
  }

  private applySteering(): void {
    if (this.steering === 0) return;
    const p = this.sim.byId(this.playerId);
    if (!p?.body) return;
    // Lead the ship by at most ~0.6 rad so releasing the button settles quickly.
    const heading = yawOf(p.body.rot);
    const next = wrapAngle(this.course + this.steering * STEER_RATE * STEP);
    this.course = wrapAngle(heading + clamp(wrapAngle(next - heading), -0.6, 0.6));
    this.send({ type: "course", ship: this.playerId, heading: this.course });
  }

  steer(direction: -1 | 0 | 1): void {
    if (direction !== 0 && this.steering === 0) {
      const p = this.sim.byId(this.playerId);
      if (p?.body) this.course = yawOf(p.body.rot);
    }
    this.steering = direction;
  }

  setSails(level: number): void {
    this.send({ type: "sails", ship: this.playerId, mast: "all", level: clamp(Math.round(level), 0, 4) as SailLevel });
  }

  toggleOars(): void {
    const p = this.sim.byId(this.playerId);
    if (p?.ship) this.send({ type: "oars", ship: this.playerId, on: !p.ship.oars });
  }
}
