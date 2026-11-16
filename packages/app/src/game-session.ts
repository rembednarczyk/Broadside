import { fortSites, openWater, generateArchipelago, type WeatherKind, type AmmoId, type GameCommand, type MountKind, type SailLevel, type ShipClassId, type UpgradeId, clamp, isHostile, standing, wrapAngle, yawOf } from "@broadside/core";
import { type Entity, STEP, Simulation, hostileTo, type SimulationOptions, type SimSnapshot, aimFor, aimForFort, canBoard, fortToStorm, restore, snapshot } from "@broadside/sim";

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

/** Enemies farther than this are not framed (beyond the longest broadside). */
const FOCUS_RANGE = 480;

/** A point where a broadside would fall (for the aiming marks on the water). */
export interface SalvoMark {
  readonly x: number;
  readonly z: number;
  /** Laid on a target (ship or fort). */
  readonly locked: boolean;
  /** Share of the battery loaded. */
  readonly ready: number;
}

export class GameSession {
  readonly sim: Simulation;
  readonly playerId: number;
  private accumulator = 0;
  private steering: -1 | 0 | 1 = 0;
  private course: number;

  private readonly options: SimulationOptions;

  /** A new game from a seed, or a saved one continued from its snapshot. */
  constructor(opts: SessionOptions, saved?: SimSnapshot) {
    this.options = { seed: opts.seed, windDirection: 1.1, windSpeed: 8, weather: opts.weather ?? "fresh", archipelago: generateArchipelago(opts.seed), traffic: true };
    if (saved) {
      this.sim = restore(saved, this.options.archipelago ?? null);
      this.playerId = this.sim.player()!.id;
      this.course = yawOf(this.sim.player()!.body!.rot);
      return;
    }
    this.sim = new Simulation(this.options);
    const player = this.sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 0.2, player: true, speed: 3 });
    this.playerId = player.id;
    this.course = 0.2;
    this.send({ type: "course", ship: this.playerId, heading: this.course });
    // Opening encounter: a pirate schooner hunting, a pirate sloop, a crown frigate on patrol and
    // a republic brig the crown is at war with.
    const map = this.sim.env.archipelago!;
    for (const site of fortSites(map)) this.sim.spawnFort(site);
    const at = (x: number, z: number) => openWater(map, x, z);
    this.sim.spawnShip({ classId: "schooner", faction: "pirates", ...at(-380, 420), heading: 2.2, speed: 3, ai: true });
    this.sim.spawnShip({ classId: "sloop", faction: "pirates", ...at(520, 650), heading: 3.6, speed: 3, ai: true });
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
  /** Where a battery would lay its guns now: the nearer of the best ship and fort in its arc. */
  private aimOf(me: Entity, mount: MountKind, side?: "port" | "starboard"): { range: number; bearing?: number; aimHeight: number; locked: boolean } {
    const arc = mount === "broadside" ? (side ?? "starboard") : mount;
    const aim = aimFor(me, this.sim.ships(), arc, true, this.sim.relations);
    const fort = aimForFort(me, this.sim.forts(), arc, this.sim.relations);
    const useFort = fort && (!aim || fort.range < aim.range);
    const range = (useFort ? fort.range : aim?.range) ?? (mount === "mortar" ? 400 : mount === "swivel" ? 80 : 220);
    const bearing = useFort ? fort.bearing : aim?.bearing;
    return { range, ...(bearing !== undefined ? { bearing } : {}), aimHeight: useFort ? fort.aimHeight : 0, locked: !!(useFort || aim) };
  }

  fire(mount: MountKind, side?: "port" | "starboard"): void {
    const me = this.sim.byId(this.playerId);
    if (!me?.body) return;
    const a = this.aimOf(me, mount, side);
    this.send({ type: "fire", ship: this.playerId, mount, side, range: a.range, bearing: a.bearing, aimHeight: a.aimHeight });
  }

  /** The nearest enemy ship or fort still fighting within gun range (the camera frames it). */
  combatFocus(): { x: number; z: number } | null {
    const me = this.sim.byId(this.playerId);
    if (!me?.body) return null;
    const p = me.body.pos;
    let best: { x: number; z: number; d: number } | null = null;
    const consider = (x: number, z: number): void => {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < FOCUS_RANGE && (!best || d < best.d)) best = { x, z, d };
    };
    for (const o of this.sim.ships()) if (o.id !== me.id && !o.ship!.sinking && !o.ship!.struck && hostileTo(me.ship!, o.ship!, this.sim.relations)) consider(o.body!.pos.x, o.body!.pos.z);
    for (const f of this.sim.forts()) if (!f.fort!.silenced && isHostile(standing(f.fort!.faction, me.ship!.faction, this.sim.relations))) consider(f.fort!.site.x, f.fort!.site.z);
    const b = best as { x: number; z: number } | null;
    return b ? { x: b.x, z: b.z } : null;
  }

  /**
   * Where each broadside would fall if fired now (Black Flag's aiming arc): a row of points along
   * the fall of shot, as long as the gun deck, at the laid range and bearing.
   */
  salvoPreview(): SalvoMark[] {
    const me = this.sim.byId(this.playerId);
    if (!me?.body || me.ship!.sinking) return [];
    const b = me.body;
    const heading = yawOf(b.rot);
    const s = me.ship!;
    const half = s.model.def.hull.length * 0.6;
    const out: SalvoMark[] = [];
    for (const side of ["port", "starboard"] as const) {
      const guns = s.model.guns.map((g, i) => ({ g, i })).filter(({ g }) => g.kind === "broadside" && g.side === side);
      if (guns.length === 0) continue;
      const ready = guns.filter(({ i }) => s.guns[i]!.reload === 0 && !s.guns[i]!.dismounted).length / guns.length;
      const a = this.aimOf(me, "broadside", side);
      const brg = a.bearing ?? heading + (side === "starboard" ? Math.PI / 2 : -Math.PI / 2);
      const cx = b.pos.x + Math.sin(brg) * a.range;
      const cz = b.pos.z + Math.cos(brg) * a.range;
      for (let k = -1; k <= 1; k++) {
        const t = k * half;
        out.push({ x: cx + Math.sin(heading) * t, z: cz + Math.cos(heading) * t, locked: a.locked, ready });
      }
    }
    return out;
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
