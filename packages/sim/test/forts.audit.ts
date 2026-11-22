import { expect, it } from "vitest";
import { FORT_CLASSES, type FortClassId, type ShipClassId, quatFromYaw, vec3 } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { type Entity } from "../src/world/components";
import { aimForFort } from "../src/combat/targeting";
import { screens } from "../src/combat/smoke";

/**
 * Forts against ships (beta test 22.11, decyzje 22.11), on open water with no land:
 * 1. gunnery: a fort's share of shot striking a frigate lying broadside-on (healed every second,
 *    so she neither sinks nor strikes), per class and range from the wall; tuned to about 35–45%
 *    at 200 m and 10–20% at 450 m (H. Douglas, "A Treatise on Naval Gunnery", 1855);
 * 2. siege: a ship anchored broadside-on at a range, firing as the player's aim assist lays the
 *    guns, until the fort falls silent, the ship is out, or 20 minutes pass; tuned so a galleon at
 *    about 400 m silences a battery in 2–4 minutes and a star fort in 8–12.
 * The gunnery share counts shot through the rigging and balls that skip off the water into the
 * hull, so it stays high close in (90% at 200 m); the siege times are the gate.
 * Run with `pnpm run audit packages/sim/test/forts.audit.ts` (FORTS=battery,citadel and
 * SIEGE='[["galleon",400]]' narrow it).
 */
const STEP = 1 / 60;
const CLASSES: FortClassId[] = process.env.FORTS ? (process.env.FORTS.split(",") as FortClassId[]) : ["watchtower", "battery", "starFort", "citadel"];

const heal = (e: Entity, full: number[], crew: number): void => {
  const s = e.ship!;
  s.sections.forEach((x, k) => {
    x.hp = full[k]!;
    x.fire = 0;
    x.water = 0;
  });
  s.crew = crew;
  s.sinking = false;
  s.struck = false;
};

/** Share of the fort's gun shots that struck (hits counted once per frame: the guns ripple). */
export const fortGunnery = (cls: FortClassId, wall: number, target: ShipClassId = "frigate", seconds = 180, speed = 0): { shots: number; hits: number } => {
  const def = FORT_CLASSES[cls];
  const sim = new Simulation({ seed: 5, windDirection: 1.1, windSpeed: 6 });
  const fort = sim.spawnFort({ x: 0, z: 0, y: 4, classId: cls, faction: "pirates", port: null, facing: 0 });
  const R = def.radius + wall;
  const ship = sim.spawnShip({ classId: target, faction: "player", x: 0, z: R, heading: Math.PI / 2 });
  sim.command({ type: "sails", ship: ship.id, mast: "all", level: 0 });
  const full = ship.ship!.sections.map((s) => s.hp);
  const crew = ship.ship!.crew;
  let shots = 0;
  let hits = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const b = ship.body!;
    b.pos = { ...b.pos, x: speed ? -speed * seconds * 0.5 + speed * i * STEP : 0, z: R };
    b.vel = { x: speed, y: b.vel.y, z: 0 };
    sim.step();
    let hit = false;
    for (const e of sim.drainEvents()) {
      if (e.type === "gunFired" && e.ship === fort.id && e.ammo !== "shell") shots++;
      if (e.type === "hit" && e.by === fort.id && e.ship === ship.id) hit = true;
    }
    if (hit) hits++;
    if (i % 60 === 0) heal(ship, full, crew);
  }
  return { shots, hits };
};

export interface SiegeResult {
  readonly silencedMin: number | null;
  readonly minutes: number;
  readonly hull: number;
  readonly out: boolean;
  readonly guns: string;
  readonly hits: number;
}

export const siege = (cls: FortClassId, cid: ShipClassId, wall: number, limitMin = 20): SiegeResult => {
  const def = FORT_CLASSES[cls];
  const sim = new Simulation({ seed: 11, windDirection: 1.1, windSpeed: 6 });
  const fort = sim.spawnFort({ x: 0, z: 0, y: 4, classId: cls, faction: "pirates", port: null, facing: 0 });
  const R = def.radius + wall;
  const ship = sim.spawnShip({ classId: cid, faction: "player", x: 0, z: R, heading: Math.PI / 2 });
  sim.command({ type: "sails", ship: ship.id, mast: "all", level: 0 });
  sim.command({ type: "anchor", ship: ship.id, down: true });
  ship.ship!.stores.round = 5000;
  const f = fort.fort!;
  let t = 0;
  let hits = 0;
  while (t < limitMin * 60 && !f.silenced) {
    const b = ship.body!;
    b.pos = { ...b.pos, x: 0, z: R };
    b.vel = { x: 0, y: b.vel.y, z: 0 };
    // Moored with a spring on the cable (broadside held on the fort).
    b.rot = quatFromYaw(Math.PI / 2);
    b.angVel = vec3(0, 0, 0);
    if (ship.ship!.sinking || ship.ship!.struck) break;
    if (Math.round(t * 60) % 30 === 0) {
      const aim = aimForFort(ship, [fort], "starboard", null, screens(sim.world));
      if (aim) sim.command({ type: "fire", ship: ship.id, mount: "broadside", side: "starboard", range: aim.range, bearing: aim.bearing, aimHeight: aim.aimHeight });
    }
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === "hit" && e.ship === fort.id) hits++;
    t += STEP;
  }
  const s = ship.ship!;
  const hull = s.sections.reduce((a, x) => a + x.hp, 0) / (s.model.def.sectionHp * s.sections.length);
  return { silencedMin: f.silenced ? t / 60 : null, minutes: t / 60, hull, out: s.sinking || s.struck, hits, guns: `${f.guns.filter((g) => g >= 0).length}/${def.guns} mortars ${f.mortars.filter((g) => g >= 0).length}/${def.mortars}` };
};

it("fort gunnery against a frigate broadside-on (report)", () => {
  const rows: string[] = [];
  for (const cls of CLASSES) {
    const cells = [60, 200, 300, 450].map((w) => {
      const r = fortGunnery(cls, w);
      return `${w} m ${r.hits}/${r.shots} (${r.shots ? Math.round((100 * r.hits) / r.shots) : 0}%)`;
    });
    rows.push(`${cls.padEnd(10)} ${cells.join("  ")}`);
  }
  const moving = CLASSES.map((cls) => {
    const r = fortGunnery(cls, 250, "frigate", 120, 6);
    return `${cls} ${r.hits}/${r.shots}`;
  });
  rows.push(`crossing at 6 m/s, 250 m: ${moving.join("  ")}`);
  console.log(rows.join("\n"));
  // Gates (decyzje 22.11): a galleon at 400 m silences a battery in 2–4 min and a star fort in
  // 8–14, and lives through both.
  const battery = siege("battery", "galleon", 400);
  const star = siege("starFort", "galleon", 400);
  expect(battery.silencedMin).not.toBeNull();
  expect(battery.silencedMin!).toBeGreaterThan(2);
  expect(battery.silencedMin!).toBeLessThan(4);
  expect(star.silencedMin).not.toBeNull();
  expect(star.silencedMin!).toBeGreaterThan(8);
  expect(star.silencedMin!).toBeLessThan(14);
  expect(battery.out || star.out).toBe(false);
});

it("siege of each fort class (report)", () => {
  const rows: string[] = [];
  for (const cls of CLASSES) {
    for (const [cid, wall] of (process.env.SIEGE ? JSON.parse(process.env.SIEGE) : [["galleon", 400], ["galleon", 250], ["frigate", 400], ["liner", 400]]) as [ShipClassId, number][]) {
      const r = siege(cls, cid, wall);
      rows.push(`${cls.padEnd(10)} ${cid.padEnd(8)} ${wall} m: ${r.silencedMin !== null ? `silenced ${r.silencedMin.toFixed(1)} min` : `not silenced in ${r.minutes.toFixed(1)} min`}, hull ${Math.round(r.hull * 100)}%${r.out ? " OUT" : ""}, hits on the fort ${r.hits}, fort ${r.guns}`);
    }
  }
  console.log(rows.join("\n"));
  // Gates (decyzje 22.11): a galleon at 400 m silences a battery in 2–4 min and a star fort in
  // 8–14, and lives through both.
  const battery = siege("battery", "galleon", 400);
  const star = siege("starFort", "galleon", 400);
  expect(battery.silencedMin).not.toBeNull();
  expect(battery.silencedMin!).toBeGreaterThan(2);
  expect(battery.silencedMin!).toBeLessThan(4);
  expect(star.silencedMin).not.toBeNull();
  expect(star.silencedMin!).toBeGreaterThan(8);
  expect(star.silencedMin!).toBeLessThan(14);
  expect(battery.out || star.out).toBe(false);
});
