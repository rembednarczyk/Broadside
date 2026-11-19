import { PlayerHelm } from "./player-helm";
import { fortSites, openWater, generateArchipelago, type WeatherKind, type AmmoId, type GameCommand, type MountKind, type SailLevel, type ShipClassId, type UpgradeId, clamp, yawOf } from "@broadside/core";
import { STEP, Simulation, type SimulationOptions, type SimSnapshot, canBoard, fortToStorm, restore, snapshot } from "@broadside/sim";
import { aimOf } from "./aiming";

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
/** At most this many steps per frame, so a long stall does not spiral (Fiedler). */
const MAX_STEPS = 8;

export class GameSession {
  readonly sim: Simulation;
  readonly playerId: number;
  private accumulator = 0;
  /** The player's helm and orders (classic and simple steering). */
  readonly helm: PlayerHelm;

  private readonly options: SimulationOptions;

  /** A new game from a seed, or a saved one continued from its snapshot. */
  constructor(opts: SessionOptions, saved?: SimSnapshot) {
    // A saved game is in the world of its own seed (a new game drew a fresh one: the address's or
    // the default seed would put her on another map, beta test 19.11).
    const seed = saved?.options.seed ?? opts.seed;
    this.options = { seed, windDirection: 1.1, windSpeed: 8, weather: opts.weather ?? "fresh", archipelago: generateArchipelago(seed), traffic: true };
    if (saved) {
      this.sim = restore(saved, this.options.archipelago ?? null);
      this.playerId = this.sim.player()!.id;
      this.helm = new PlayerHelm(this.sim, this.playerId, yawOf(this.sim.player()!.body!.rot));
      return;
    }
    this.sim = new Simulation(this.options);
    const player = this.sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 0.2, player: true, speed: 3 });
    this.playerId = player.id;
    this.helm = new PlayerHelm(this.sim, this.playerId, 0.2);
    this.send({ type: "course", ship: this.playerId, heading: 0.2 });
    // Opening encounter: a pirate schooner hunting, a pirate sloop, a crown frigate on patrol and
    // a republic brig the crown is at war with.
    const map = this.sim.env.archipelago!;
    for (const site of fortSites(map)) this.sim.spawnFort(site);
    const at = (x: number, z: number) => openWater(map, x, z);
    // The pirates start some 1.5 km off: a new captain has a few minutes to find the helm and the
    // guns (at 560 and 830 m they sank a galleon left to herself in 4-7 minutes, beta test 19.11).
    this.sim.spawnShip({ classId: "schooner", faction: "pirates", ...at(-1050, 1100), heading: 2.2, speed: 3, ai: true });
    this.sim.spawnShip({ classId: "sloop", faction: "pirates", ...at(1250, 1150), heading: 3.6, speed: 3, ai: true });
    this.sim.spawnShip({ classId: "frigate", faction: "crown", ...at(1500, -300), heading: 4.2, speed: 3, ai: true });
    this.sim.spawnShip({ classId: "brig", faction: "republic", ...at(1700, 900), heading: 3.4, speed: 3, ai: true });
  }

  /** Memento of the game for the save slot. */
  save(): SimSnapshot {
    for (const e of [...this.sim.world.with("shot")]) this.sim.world.remove(e);
    return snapshot(this.sim, this.options);
  }

  /** Buys a ship at the yard of a port alongside (the old one goes in part exchange). */
  buyShip(port: number, classId: ShipClassId): void {
    this.send({ type: "trade", ship: this.playerId, port, service: "buyShip", qty: 1, classId });
  }

  /** Takes the contract the harbour master of a port alongside offers. */
  takeContract(port: number): void {
    this.send({ type: "trade", ship: this.playerId, port, service: "contract", qty: 1 });
  }

  /** Has the yard of a port alongside fit a refit to the current hull. */
  refit(port: number, upgrade: UpgradeId): void {
    this.send({ type: "trade", ship: this.playerId, port, service: "upgrade", qty: 1, upgrade });
  }

  /** Port services while alongside a port (index into the world's ports). */
  trade(port: number, service: "ammo" | "crew" | "repair" | "provisions" | "sellPlunder", qty: number, ammo?: AmmoId): void {
    this.send({ type: "trade", ship: this.playerId, port, service, qty, ...(ammo ? { ammo } : {}) });
  }

  private send(cmd: GameCommand): void {
    this.sim.command(cmd);
  }

  /** Advances the simulation by real elapsed seconds; returns the number of steps taken. */
  advance(seconds: number): number {
    this.accumulator = Math.min(this.accumulator + Math.max(0, seconds), STEP * MAX_STEPS);
    let n = 0;
    while (this.accumulator >= STEP) {
      this.helm.apply();
      this.sim.step();
      this.accumulator -= STEP;
      n++;
    }
    return n;
  }

  /** Standing orders to the crew: reef in squalls without being told. */
  crewOrders(reef: boolean): void {
    this.send({ type: "crew", ship: this.playerId, reef });
  }

  /** Assisted sailing (the Action steering mode): on or off, and astern with the sails backed. */
  assist(on: boolean, astern = false): void {
    this.send({ type: "assist", ship: this.playerId, on, astern });
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
    const a = aimOf(this.sim, me, mount, side);
    this.send({ type: "fire", ship: this.playerId, mount, side, range: a.range, bearing: a.bearing, aimHeight: a.aimHeight });
  }




  /** Boards the nearest ship alongside, if any. */
  board(): void {
    const me = this.sim.byId(this.playerId);
    if (!me?.body) return;
    const t = this.sim.ships().filter((o) => o.id !== me.id && canBoard(me, o)).sort((a, b) => Math.hypot(a.body!.pos.x - me.body!.pos.x, a.body!.pos.z - me.body!.pos.z) - Math.hypot(b.body!.pos.x - me.body!.pos.x, b.body!.pos.z - me.body!.pos.z))[0];
    if (t) this.send({ type: "board", ship: this.playerId, target: t.id });
  }

  /** Storms the nearest silenced fort within reach, if any. */
  assault(): void {
    const me = this.sim.byId(this.playerId);
    if (!me?.body) return;
    const f = fortToStorm(me, this.sim.forts());
    if (f) this.send({ type: "assault", ship: this.playerId, fort: f.id });
  }

  loadAmmo(ammo: AmmoId): void {
    this.send({ type: "loadAmmo", ship: this.playerId, mount: "broadside", ammo });
  }

  brace(): void {
    this.send({ type: "brace", ship: this.playerId });
  }

  drop(kind: "fireBarrel" | "mine" | "smoke"): void {
    this.send({ type: "drop", ship: this.playerId, ammo: kind });
  }

  /** Toggles Greek fire in the bow chaser (back to round shot) or rockets in the swivels (back to grape). */
  special(mount: "bowChaser" | "swivel"): void {
    const s = this.sim.byId(this.playerId)?.ship;
    if (!s) return;
    const [special, plain]: [AmmoId, AmmoId] = mount === "bowChaser" ? ["greekFire", "round"] : ["rocket", "grape"];
    this.send({ type: "loadAmmo", ship: this.playerId, mount, ammo: s.ammoLoad[mount] === special ? plain : special });
  }

  toggleOars(): void {
    const p = this.sim.byId(this.playerId);
    if (p?.ship) this.send({ type: "oars", ship: this.playerId, on: !p.ship.oars });
  }
}
