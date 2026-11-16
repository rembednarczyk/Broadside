import { type MountKind, canFire, AMMO_IDS, wrapAngle, yawOf } from "@broadside/core";
import { type Entity, type ShipState, type Simulation, aimFor, aimForFort, canBoard, fortToStorm } from "@broadside/sim";
import { type BatteryHud, type CombatHud, type TargetHud } from "@broadside/ui";

/** Reads the player's guns, stores and condition, and the current target (Presenter). */
const battery = (s: ShipState, kind: MountKind, side?: "port" | "starboard"): BatteryHud => {
  const idx = s.model.guns.map((g, i) => ({ g, i })).filter(({ g }) => g.kind === kind && (!side || g.side === side));
  const ready = idx.filter(({ i }) => s.guns[i]!.reload === 0 && !s.guns[i]!.dismounted).length;
  return { count: idx.length, ready: idx.length ? ready / idx.length : 0 };
};

export const presentCombat = (e: Entity, forts: readonly Entity[] = [], ships: readonly Entity[] = []): CombatHud | null => {
  const s = e.ship;
  if (!s) return null;
  return {
    port: battery(s, "broadside", "port"),
    starboard: battery(s, "broadside", "starboard"),
    bow: battery(s, "bowChaser"),
    stern: battery(s, "sternChaser"),
    mortar: battery(s, "mortar"),
    swivel: battery(s, "swivel"),
    broadsideAmmo: s.ammoLoad.broadside ?? "round",
    ammo: AMMO_IDS.filter((a) => canFire(a, "broadside")).map((id) => ({ id, left: s.stores[id] ?? 0 })),
    barrels: s.stores.fireBarrel ?? 0,
    mines: s.stores.mine ?? 0,
    braced: s.braced > 0,
    hull: s.sections.reduce((a, x) => a + x.hp, 0) / (s.model.def.sectionHp * s.sections.length),
    crew: s.crew,
    crewMax: s.model.def.crew,
    fires: s.sections.filter((x) => x.fire > 0).length,
    water: s.sections.reduce((a, x) => a + x.water, 0),
    canStorm: e.body ? fortToStorm(e, forts) !== null : false,
    canBoard: e.body ? ships.some((o) => o.id !== e.id && canBoard(e, o)) : false,
  };
};

export const presentTarget = (sim: Simulation, me: Entity): TargetHud | null => {
  const ships = sim.ships();
  const has = (k: MountKind) => me.ship!.model.guns.some((g) => g.kind === k);
  const arcs = [
    ...(has("broadside") ? (["port", "starboard"] as const) : []),
    ...(has("bowChaser") ? (["bowChaser"] as const) : []),
    ...(has("sternChaser") ? (["sternChaser"] as const) : []),
    ...(has("mortar") ? (["mortar"] as const) : []),
  ];
  const aims = arcs.map((a) => aimFor(me, ships, a, true, sim.relations)).filter((a) => a !== null);
  const aim = aims.sort((a, b) => a.range - b.range)[0];
  const fortAims = arcs.map((a) => aimForFort(me, sim.forts(), a, sim.relations)).filter((a) => a !== null).sort((a, b) => a.range - b.range);
  const fa = fortAims[0];
  if (fa && (!aim || fa.range < aim.range)) {
    const f = fa.fort.fort!;
    return { kind: "fort", classId: f.def.id, faction: f.faction, range: fa.range, hull: f.hp / f.def.hp, crew: f.garrison, struck: false, side: "ahead", guns: [f.guns.filter((g) => g >= 0).length, f.def.guns], silenced: f.silenced };
  }
  if (!aim) return null;
  const t = aim.target.ship!;
  const rel = wrapAngle(aim.bearing - yawOf(me.body!.rot));
  const side = Math.abs(rel) < 0.6 ? "ahead" : Math.abs(rel) > Math.PI - 0.6 ? "astern" : rel > 0 ? "starboard" : "port";
  return {
    kind: "ship",
    classId: t.model.def.id,
    faction: t.faction,
    range: aim.range,
    hull: t.sections.reduce((a, x) => a + x.hp, 0) / (t.model.def.sectionHp * t.sections.length),
    crew: t.crew,
    struck: t.struck,
    side,
  };
};
