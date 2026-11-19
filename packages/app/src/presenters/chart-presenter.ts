import { type Archipelago, SURVEY, contourLoops, fortSites, heightGrid, isHostile, standing, surveyIndex, surveySide, wreckSites, yawOf } from "@broadside/core";
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

/**
 * The unsurveyed sea as rectangles (world metres): each row's runs of unseen cells merged, so the
 * fog is a few dozen shapes, not a thousand.
 */
export const fogRects = (a: Archipelago, seen: readonly number[]): { x: number; z: number; w: number; h: number }[] => {
  const n = surveySide(a);
  const known = new Set(seen);
  const out: { x: number; z: number; w: number; h: number }[] = [];
  for (let j = 0; j < n; j++) {
    let start = -1;
    for (let i = 0; i <= n; i++) {
      const fog = i < n && !known.has(j * n + i);
      if (fog && start < 0) start = i;
      if (!fog && start >= 0) {
        out.push({ x: -a.half + start * SURVEY.cell, z: -a.half + j * SURVEY.cell, w: (i - start) * SURVEY.cell, h: SURVEY.cell });
        start = -1;
      }
    }
  }
  return out;
};

/**
 * The sea chart (the menu's chart screen; Presentation Model, as the other presenters). The fog
 * of war (core/world/survey): forts and wrecks only where the lookout has been, other ships only
 * within his sight now; the ports stay on the chart (their names and places were common knowledge).
 */
export const presentChart = (sim: Simulation, playerId: number): ChartHud | null => {
  const a = sim.env.archipelago;
  if (!a) return null;
  const fixed = trace(a);
  const me = sim.byId(playerId);
  const mine = me?.ship?.faction;
  const seen = new Set(sim.survey.seen);
  const surveyed = (x: number, z: number) => seen.has(surveyIndex(a, x, z));
  const at = me?.body?.pos;
  const ships = sim.ships().flatMap((e) => {
    if (!e.body || !e.ship || e.ship.sinking) return [];
    if (e.id !== playerId && (!at || Math.hypot(e.body.pos.x - at.x, e.body.pos.z - at.z) > SURVEY.sight)) return [];
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
    forts: forts.filter((f) => surveyed(f.x, f.z)),
    wrecks: fixed.wrecks.map((w, i) => ({ ...w, salvaged: sim.salvage.salvaged.includes(i) })).filter((w) => surveyed(w.x, w.z)),
    fog: fogRects(a, sim.survey.seen),
    ships,
    route: course.path,
    goal: course.goal ? { x: course.goal.x, z: course.goal.z } : null,
  };
};
