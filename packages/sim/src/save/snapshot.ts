import { type Archipelago, type FortSite, type Quat, type ShipClassId, type Vec3, type WeatherKind, type WeatherState, WORLD_VERSION, createRng, fortSites, openWater, seaWaves } from "@broadside/core";
import { Simulation, type SimulationOptions } from "../simulation";
import { type CaptainState } from "../ai/captain-state";
import { type PilotState, upgradePilot } from "../ai/pilot/state";
import { type ReefingState } from "../systems/reefing-state";
import { type AssistState } from "../world/components";
import { type Castaway, type Floater, type FortState } from "../world/components";
import { type ShipState } from "../ship/ship-state";
import { shipModel } from "../ship/ship-model";
import { createBody } from "../physics/rigid-body";
import { type Purse } from "../economy/purse";
import { type Relations, type StormCell } from "@broadside/core";
import { type Salvage } from "../economy/salvage-state";
import { type Survey } from "../economy/survey-state";
import { type Jobs } from "../economy/contracts";

/**
 * Save game as a Memento (GoF): a plain JSON-able snapshot of everything that is not derived
 * (ship models and the archipelago come from their ids and the seed). Shots in flight are not
 * saved: a save is taken between broadsides. Restoring and stepping continues exactly as the
 * original would have (random streams resume from their saved states).
 */
export const SNAPSHOT_VERSION = 1;

type ShipFields = Omit<ShipState, "model">;

export interface ShipSnap {
  readonly id: number;
  readonly classId: ShipClassId;
  readonly player: boolean;
  readonly body: { pos: Vec3; vel: Vec3; rot: Quat; angVel: Vec3 };
  readonly ship: ShipFields;
  readonly captain: CaptainState | null;
  /** Route under simple steering (absent in saves written before it). */
  readonly pilot?: PilotState | null;
  /** Standing order to reef (absent in older saves). */
  readonly reefing?: ReefingState | null;
  readonly assist?: AssistState | null;
  readonly anchor?: { x: number; z: number } | null;
  readonly ttl: number | null;
}

export interface SimSnapshot {
  readonly version: number;
  readonly options: { seed: number; windDirection: number; windSpeed: number; weather: WeatherKind | null; archipelago: boolean; traffic?: boolean; /** The land's generator version (core WORLD_VERSION); absent: 1. */ world?: number };
  readonly steps: number;
  readonly nextId: number;
  readonly rng: number;
  readonly env: { time: number; windDirection: number; windSpeed: number; seaWind: number; swell: number; rogue: number; weatherRng: number; weather: WeatherState | null; cells?: StormCell[] };
  readonly purse: Purse;
  /** Absent in saves from before reputation (standings at the start then). */
  readonly relations?: Relations;
  readonly jobs?: Jobs;
  /** Absent in saves from before salvage (nothing salvaged then). */
  readonly salvage?: Salvage;
  /** Absent in saves from before the chart's fog of war (the lookout sweeps again from where the ship lies). */
  readonly survey?: Survey;
  readonly ships: readonly ShipSnap[];
  readonly forts: readonly { id: number; site: FortSite; state: Omit<FortState, "def" | "site"> }[];
  readonly castaways: readonly Castaway[];
  readonly floaters: readonly Floater[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const snapshot = (sim: Simulation, options: SimulationOptions): SimSnapshot => ({
  version: SNAPSHOT_VERSION,
  options: { seed: options.seed, windDirection: options.windDirection, windSpeed: options.windSpeed, weather: options.weather ?? null, archipelago: !!options.archipelago, traffic: options.traffic ?? false, world: WORLD_VERSION },
  steps: sim.steps,
  nextId: sim.nextId,
  rng: sim.rngState(),
  env: { time: sim.env.time, windDirection: sim.env.windDirection, windSpeed: sim.env.windSpeed, seaWind: sim.env.seaWind, swell: sim.env.swell, rogue: sim.env.rogue, weatherRng: sim.env.weatherRng.state(), weather: clone(sim.env.weather), cells: clone(sim.env.cells) },
  purse: { ...sim.purse },
  relations: { ...sim.relations },
  jobs: clone(sim.jobs),
  salvage: clone(sim.salvage),
  survey: clone(sim.survey),
  ships: sim.ships().map((e) => {
    const { model: _model, ...fields } = e.ship!;
    const b = e.body!;
    return { id: e.id, classId: e.ship!.model.def.id, player: !!e.player, body: { pos: b.pos, vel: b.vel, rot: b.rot, angVel: b.angVel }, ship: clone(fields), captain: e.captain ? clone(e.captain) : null, ...(e.pilot ? { pilot: clone(e.pilot) } : {}), ...(e.reefing ? { reefing: clone(e.reefing) } : {}), ...(e.assist ? { assist: clone(e.assist) } : {}), ...(e.anchor ? { anchor: clone(e.anchor) } : {}), ttl: e.ttl ?? null };
  }),
  forts: sim.forts().map((e) => {
    const { def: _def, site, ...state } = e.fort!;
    return { id: e.id, site, state: clone(state) };
  }),
  castaways: [...sim.world.with("castaway")].map((e) => clone(e.castaway)),
  floaters: [...sim.world.with("floater")].map((e) => clone(e.floater)),
});

/** Rebuilds a simulation from a snapshot; the archipelago is regenerated from the seed by the caller. */
/** Captains saved before standing orders existed patrol. */
const withOrders = (c: CaptainState): CaptainState => {
  const o = c as Omit<CaptainState, "role" | "dest" | "leader"> & Partial<Pick<CaptainState, "role" | "dest" | "leader">>;
  return { ...o, role: o.role ?? "patrol", dest: o.dest ?? -1, leader: o.leader ?? -1 };
};

export const restore = (snap: SimSnapshot, archipelago: Archipelago | null): Simulation => {
  const o = snap.options;
  const sim = new Simulation({ seed: o.seed, windDirection: o.windDirection, windSpeed: o.windSpeed, ...(o.weather ? { weather: o.weather } : {}), ...(archipelago ? { archipelago } : {}), traffic: o.traffic ?? false });
  sim.steps = snap.steps;
  sim.restoreRng(snap.rng);
  Object.assign(sim.env, { time: snap.env.time, windDirection: snap.env.windDirection, windSpeed: snap.env.windSpeed, seaWind: snap.env.seaWind, swell: snap.env.swell, rogue: snap.env.rogue, weather: clone(snap.env.weather), cells: clone(snap.env.cells ?? []) });
  sim.env.weatherRng = createRng(snap.env.weatherRng);
  // The waves derive from the restored sea state: recompute them now (the step only does so
  // when the sea changes).
  sim.env.waves = seaWaves(sim.env.bands, { windSpeed: snap.env.seaWind, swell: snap.env.swell });
  Object.assign(sim.purse, snap.purse);
  if (snap.relations) Object.assign(sim.relations, snap.relations);
  if (snap.jobs) sim.jobs.active = clone(snap.jobs.active);
  if (snap.salvage) Object.assign(sim.salvage, clone(snap.salvage));
  if (snap.survey) Object.assign(sim.survey, clone(snap.survey));
  for (const s of snap.ships) {
    const model = shipModel(s.classId);
    const body = createBody(model.mass, model.inertia, s.body.pos, s.body.rot);
    body.vel = s.body.vel;
    body.angVel = s.body.angVel;
    // Fields added after a save was written get their defaults (refits, standing orders).
    const old = clone(s.ship) as Partial<Omit<ShipState, "model">> & Omit<ShipState, "model" | "upgrades" | "wrecks" | "taken" | "aground">;
    const ship: ShipState = { model, ...old, upgrades: old.upgrades ?? [], wrecks: old.wrecks ?? [], taken: old.taken ?? false, aground: old.aground ?? false };
    sim.world.add({ id: s.id, body, ship, ...(s.player ? { player: true as const } : {}), ...(s.captain ? { captain: withOrders(clone(s.captain)) } : {}), ...(s.pilot ? { pilot: upgradePilot(clone(s.pilot)) } : {}), ...(s.reefing ? { reefing: clone(s.reefing) } : {}), ...(s.assist ? { assist: clone(s.assist) } : {}), ...(s.anchor ? { anchor: clone(s.anchor) } : {}), ...(s.ttl !== null ? { ttl: s.ttl } : {}) });
  }
  // A save from an older world: the land has moved under it. The ships are moved off it to the
  // nearest open water, the forts rebuilt where the new shores have them, and what pointed at the
  // old ports and wrecks (the contract, the salvaged list) let go; the purse, the standing with
  // the nations and the ships themselves are kept.
  const stale = !!archipelago && (o.world ?? 1) < WORLD_VERSION;
  if (stale) {
    for (const e of sim.ships()) {
      const p = openWater(archipelago, e.body!.pos.x, e.body!.pos.z, 60);
      e.body!.pos = { ...e.body!.pos, x: p.x, z: p.z };
      delete e.anchor;
      delete e.pilot;
    }
    for (const site of fortSites(archipelago)) sim.spawnFort(site);
    sim.jobs.active = null;
    sim.salvage.salvaged.length = 0;
    sim.survey.seen = [];
  }
  for (const f of stale ? [] : snap.forts) {
    const e = sim.spawnFort(f.site);
    Object.assign(e.fort!, clone(f.state));
    e.id = f.id;
  }
  for (const c of snap.castaways) sim.world.add({ id: 0, castaway: clone(c) });
  for (const fl of snap.floaters) sim.world.add({ id: 0, floater: clone(fl) });
  sim.nextId = snap.nextId;
  return sim;
};
