import { openWater, generateArchipelago, type WeatherKind, type AmmoId, type GameCommand, type MountKind, type SailLevel, clamp, wrapAngle, yawOf } from "@broadside/core";
import { STEP, Simulation, aimFor } from "@broadside/sim";

/**
 * The game loop without a browser (SpinalTap's GameSession, split by ADR-0031): fixed-step
 * accumulation (Fiedler, "Fix Your Timestep!"), and the translation of player intents into
 * simulation commands. Rendering and DOM live outside; tests drive this class directly.
 */
export interface SessionOptions {
  readonly seed: number;
  /** Starting weather (default: fresh wind). */
  readonly weather?: WeatherKind;
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
    this.sim = new Simulation({ seed: opts.seed, windDirection: 1.1, windSpeed: 8, weather: opts.weather ?? "fresh", archipelago: generateArchipelago(opts.seed) });
    const player = this.sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 0.2, player: true, speed: 3 });
    this.playerId = player.id;
    this.course = 0.2;
    this.send({ type: "course", ship: this.playerId, heading: this.course });
    // Opening encounter: a pirate schooner hunting, a pirate sloop, a crown frigate on patrol and
    // a republic brig the crown is at war with.
    const map = this.sim.env.archipelago!;
    const at = (x: number, z: number) => openWater(map, x, z);
    this.sim.spawnShip({ classId: "schooner", faction: "pirates", ...at(-380, 420), heading: 2.2, speed: 3, ai: true });
    this.sim.spawnShip({ classId: "sloop", faction: "pirates", ...at(520, 650), heading: 3.6, speed: 3, ai: true });
    this.sim.spawnShip({ classId: "frigate", faction: "crown", ...at(1500, -300), heading: 4.2, speed: 3, ai: true });
    this.sim.spawnShip({ classId: "brig", faction: "republic", ...at(1700, 900), heading: 3.4, speed: 3, ai: true });
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

  setMastSails(mast: number, level: number): void {
    this.send({ type: "sails", ship: this.playerId, mast, level: clamp(Math.round(level), 0, 4) as SailLevel });
  }

  setSails(level: number): void {
    this.send({ type: "sails", ship: this.playerId, mast: "all", level: clamp(Math.round(level), 0, 4) as SailLevel });
  }

  /** Fires a battery with aim assist: range and bearing of the best target in its arc, if any. */
  fire(mount: MountKind, side?: "port" | "starboard"): void {
    const me = this.sim.byId(this.playerId);
    if (!me?.body) return;
    const arc = mount === "broadside" ? (side ?? "starboard") : mount;
    const aim = aimFor(me, this.sim.ships(), arc);
    const range = aim?.range ?? (mount === "mortar" ? 400 : mount === "swivel" ? 80 : 220);
    this.send({ type: "fire", ship: this.playerId, mount, side, range, bearing: aim?.bearing });
  }

  loadAmmo(ammo: AmmoId): void {
    this.send({ type: "loadAmmo", ship: this.playerId, mount: "broadside", ammo });
  }

  brace(): void {
    this.send({ type: "brace", ship: this.playerId });
  }

  drop(kind: "fireBarrel" | "mine"): void {
    this.send({ type: "drop", ship: this.playerId, ammo: kind });
  }

  toggleOars(): void {
    const p = this.sim.byId(this.playerId);
    if (p?.ship) this.send({ type: "oars", ship: this.playerId, on: !p.ship.oars });
  }
}
