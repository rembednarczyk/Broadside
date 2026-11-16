import { type MountKind, isHostile, standing, yawOf } from "@broadside/core";
import { type Entity, type Simulation, aimFor, aimForFort, hostileTo } from "@broadside/sim";

/**
 * Gun laying for the player (aim assist) and what the views need of it: where each broadside
 * would fall and which enemy the isometric camera should keep in frame.
 */

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

/** Where a battery would lay its guns now: the nearer of the best ship and fort in its arc. */
export const aimOf = (sim: Simulation, me: Entity, mount: MountKind, side?: "port" | "starboard"): { range: number; bearing?: number; aimHeight: number; locked: boolean } => {
  const arc = mount === "broadside" ? (side ?? "starboard") : mount;
  const aim = aimFor(me, sim.ships(), arc, true, sim.relations);
  const fort = aimForFort(me, sim.forts(), arc, sim.relations);
  const useFort = fort && (!aim || fort.range < aim.range);
  const range = (useFort ? fort.range : aim?.range) ?? (mount === "mortar" ? 400 : mount === "swivel" ? 80 : 220);
  const bearing = useFort ? fort.bearing : aim?.bearing;
  return { range, ...(bearing !== undefined ? { bearing } : {}), aimHeight: useFort ? fort.aimHeight : 0, locked: !!(useFort || aim) };
};

/** The nearest enemy ship or fort still fighting within gun range (the camera frames it). */
export const combatFocus = (sim: Simulation, playerId: number): { x: number; z: number } | null => {
  const me = sim.byId(playerId);
  if (!me?.body) return null;
  const p = me.body.pos;
  let best: { x: number; z: number; d: number } | null = null;
  const consider = (x: number, z: number): void => {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < FOCUS_RANGE && (!best || d < best.d)) best = { x, z, d };
};
  for (const o of sim.ships()) if (o.id !== me.id && !o.ship!.sinking && !o.ship!.struck && hostileTo(me.ship!, o.ship!, sim.relations)) consider(o.body!.pos.x, o.body!.pos.z);
  for (const f of sim.forts()) if (!f.fort!.silenced && isHostile(standing(f.fort!.faction, me.ship!.faction, sim.relations))) consider(f.fort!.site.x, f.fort!.site.z);
  const b = best as { x: number; z: number } | null;
  return b ? { x: b.x, z: b.z } : null;
};

/**
 * Where each broadside would fall if fired now (Black Flag's aiming arc): a row of points along
 * the fall of shot, as long as the gun deck, at the laid range and bearing.
 */
export const salvoPreview = (sim: Simulation, playerId: number): SalvoMark[] => {
  const me = sim.byId(playerId);
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
    const a = aimOf(sim, me, "broadside", side);
    const brg = a.bearing ?? heading + (side === "starboard" ? Math.PI / 2 : -Math.PI / 2);
    const cx = b.pos.x + Math.sin(brg) * a.range;
    const cz = b.pos.z + Math.cos(brg) * a.range;
    for (let k = -1; k <= 1; k++) {
      const t = k * half;
      out.push({ x: cx + Math.sin(heading) * t, z: cz + Math.cos(heading) * t, locked: a.locked, ready });
    }
  }
  return out;
};
