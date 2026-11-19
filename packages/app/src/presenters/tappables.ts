import { wreckSites } from "@broadside/core";
import { type Simulation, hostileTo } from "@broadside/sim";
import { type Tappable } from "../controllers/tap-targets";

/** Screen position of a world point in client pixels. */
export type Project = (x: number, y: number, z: number) => { x: number; y: number };

/** A finger's width at least: smaller things are still easy to hit. */
const MIN_REACH = 28;

/**
 * The things a tap can find (simple steering): the ships with their reach on screen half their
 * drawn length, the ports' approaches and the forts, each projected to the screen now.
 */
export const presentTappables = (sim: Simulation, playerId: number, project: Project): Tappable[] => {
  const me = sim.byId(playerId);
  const out: Tappable[] = [];
  for (const e of sim.ships()) {
    if (!e.body || !e.ship || e.ship.sinking) continue;
    const p = e.body.pos;
    const c = project(p.x, 2, p.z);
    const half = e.ship.model.def.hull.length / 2;
    const tip = project(p.x + half, 2, p.z);
    const reach = Math.max(MIN_REACH, Math.hypot(tip.x - c.x, tip.y - c.y));
    const self = e.id === playerId;
    const hostile = !self && !!me?.ship && !e.ship.struck && hostileTo(me.ship, e.ship, sim.relations);
    out.push({ kind: self ? "self" : "ship", id: e.id, sx: c.x, sy: c.y, reach, at: { x: p.x, z: p.z }, hostile });
  }
  sim.ports.forEach((port, i) => {
    const c = project(port.ax, 0, port.az);
    out.push({ kind: "port", id: i, sx: c.x, sy: c.y, reach: MIN_REACH * 1.4, at: { x: port.ax, z: port.az } });
  });
  // Wrecks not yet stripped (sim salvage): a tap sends the crew to lie over her.
  const a = sim.env.archipelago;
  if (a) {
    wreckSites(a).forEach((w, i) => {
      if (sim.salvage.salvaged.includes(i)) return;
      const c = project(w.x, 0, w.z);
      out.push({ kind: "wreck", id: i, sx: c.x, sy: c.y, reach: MIN_REACH * 1.4, at: { x: w.x, z: w.z } });
    });
  }
  for (const f of sim.forts()) {
    const site = f.fort!.site;
    const c = project(site.x, 5, site.z);
    const edge = project(site.x + f.fort!.def.radius, 5, site.z);
    out.push({ kind: "fort", id: f.id, sx: c.x, sy: c.y, reach: Math.max(MIN_REACH, Math.hypot(edge.x - c.x, edge.y - c.y)), at: { x: site.x, z: site.z } });
  }
  return out;
};
