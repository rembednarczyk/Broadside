import { type Archipelago, contourLoops, fortSites, heightGrid, isHostile, standing, wreckSites, yawOf } from "@broadside/core";
import { type Simulation, hostileTo, portOwner } from "@broadside/sim";
import { type ChartHud } from "@broadside/ui";
import { presentCourse } from "./course-presenter";

/** Spacing of the height samples the chart's contours are traced from (m). */
const CHART_CELL = 40;
/** The edge of the shallows drawn on the chart (m below the surface). */
const SHOAL_DEPTH = -4;

/** The chart's fixed part, traced once per archipelago (the contours cost some forty thousand height samples). */
let traced: { a: Archipelago; land: ChartHud["land"]; shoals: ChartHud["shoals"]; wrecks: { x: number; z: number }[] } | null = null;
const trace = (a: Archipelago) => {
  if (traced?.a !== a) {
    const grid = heightGrid(a, CHART_CELL);
    traced = {
      a,
      land: contourLoops(grid, 0),
      shoals: contourLoops(grid, SHOAL_DEPTH),
      wrecks: wreckSites(a).map((w) => ({ x: w.x, z: w.z })),
    };
  }
  return traced;
};

/** The sea chart (the menu's chart screen; Presentation Model, as the other presenters). */
export const presentChart = (sim: Simulation, playerId: number): ChartHud | null => {
  const a = sim.env.archipelago;
  if (!a) return null;
  const fixed = trace(a);
  const me = sim.byId(playerId);
  const mine = me?.ship?.faction;
  const ships = sim.ships().flatMap((e) => {
    if (!e.body || !e.ship || e.ship.sinking) return [];
    const kind = e.id === playerId ? "player" : me?.ship && !e.ship.struck && hostileTo(me.ship, e.ship, sim.relations) ? "hostile" : "other";
    return [{ x: e.body.pos.x, z: e.body.pos.z, heading: yawOf(e.body.rot), kind } as const];
  });
  const forts = sim.forts().length
    ? sim.forts().map((f) => ({ x: f.fort!.site.x, z: f.fort!.site.z, hostile: mine !== undefined && !f.fort!.silenced && isHostile(standing(mine, f.fort!.faction, sim.relations)) }))
    : fortSites(a).map((s) => ({ x: s.x, z: s.z, hostile: mine !== undefined && isHostile(standing(mine, s.faction, sim.relations)) }));
  const ports = sim.ports.map((p, i) => {
    const owner = portOwner(sim.world, i, p);
    return { x: p.x, z: p.z, name: p.name, faction: owner, hostile: mine !== undefined && isHostile(standing(mine, owner, sim.relations)) };
  });
  const course = presentCourse(sim, playerId);
  return {
    half: a.half,
    land: fixed.land,
    shoals: fixed.shoals,
    ports,
    forts,
    wrecks: fixed.wrecks.map((w, i) => ({ ...w, salvaged: sim.salvage.salvaged.includes(i) })),
    ships,
    route: course.path,
    goal: course.goal ? { x: course.goal.x, z: course.goal.z } : null,
  };
};
