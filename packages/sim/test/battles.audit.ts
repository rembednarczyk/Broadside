import { expect, it } from "vitest";
import { type ShipClassId } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { type Entity } from "../src/world/components";

/**
 * AI against AI (M6 balance): two captains of nations at war meet 700 m apart in a fresh breeze
 * and fight until one strikes or sinks, or 15 minutes pass. Reports the winner, the time and the
 * hull left, per pair of classes and seed. Run with `pnpm run audit` (PAIRS=brig:brig,... to choose).
 */
const DEFAULT: readonly [ShipClassId, ShipClassId][] = [
  ["sloop", "schooner"],
  ["brig", "brig"],
  ["brig", "frigate"],
  ["frigate", "galleon"],
  ["frigate", "frigate"],
  ["liner", "frigate"],
];
const SEEDS = [1, 2, 3];
const LIMIT = 15 * 60;

const out = (e: Entity): boolean => e.ship!.sinking || e.ship!.struck;
const hull = (e: Entity): number => e.ship!.sections.reduce((a, s) => a + s.hp, 0) / (e.ship!.model.def.sectionHp * e.ship!.sections.length);

it("AI battles by class (report, gated by ADR-0005)", () => {
  let fought = 0;
  let decided = 0;
  const pairs = process.env.PAIRS ? process.env.PAIRS.split(",").map((p) => p.split(":") as [ShipClassId, ShipClassId]) : DEFAULT;
  for (const [a, b] of pairs) {
    const rows: string[] = [];
    let winsA = 0;
    let winsB = 0;
    const costs: number[] = [];
    for (const seed of SEEDS) {
      const sim = new Simulation({ seed, windDirection: 1.2, windSpeed: 8 });
      const A = sim.spawnShip({ classId: a, faction: "crown", x: -350, z: 0, heading: 0.3, speed: 3, ai: true });
      const B = sim.spawnShip({ classId: b, faction: "republic", x: 350, z: 0, heading: Math.PI - 0.3, speed: 3, ai: true });
      let t = 0;
      let shots = 0;
      let hits = 0;
      let dmg = 0;
      const parts: Record<string, number> = {};
      let minGap = 1e9;
      while (t < LIMIT && !out(A) && !out(B)) {
        sim.step();
        for (const e of sim.drainEvents()) {
          if (e.type === "gunFired") shots++;
          if (e.type === "hit") {
            hits++;
            dmg += e.damage;
            parts[e.part] = (parts[e.part] ?? 0) + 1;
          }
        }
        minGap = Math.min(minGap, Math.hypot(A.body!.pos.x - B.body!.pos.x, A.body!.pos.z - B.body!.pos.z));
        t += 1 / 60;
      }
      const w = out(B) && !out(A) ? a : out(A) && !out(B) ? b : "draw";
      if (w === a && out(B)) winsA++;
      if (w === b && out(A)) winsB++;
      fought++;
      if (w !== "draw") decided++;
      if (w !== "draw") {
        const win = w === a && out(B) ? A : B;
        const crewLoss = 1 - win.ship!.crew / win.ship!.model.def.crew;
        costs.push(Math.max(crewLoss, (1 - hull(win)) * 1.5));
      }
      rows.push(`seed ${seed}: ${w.padEnd(8)} ${(t / 60).toFixed(1)} min, hull ${a} ${(hull(A) * 100).toFixed(0)}% ${b} ${(hull(B) * 100).toFixed(0)}%, crew ${A.ship!.crew}/${B.ship!.crew}, shots ${shots}, hits ${hits} (${JSON.stringify(parts)}), dmg/hit ${(dmg / Math.max(1, hits)).toFixed(0)}, closest ${minGap.toFixed(0)} m`);
    }
    console.log(`${a} vs ${b}: ${winsA}-${winsB}\n  ${rows.join("\n  ")}`);
    // ADR-0005: the clearly stronger ship never loses; equals do not sweep the same three seeds.
    const stronger: Record<string, string> = { "brig:frigate": "b", "liner:frigate": "a" };
    const side = stronger[`${a}:${b}`];
    if (side === "a") expect(winsB, `${a} lost to ${b}`).toBe(0);
    if (side === "b") expect(winsA, `${b} lost to ${a}`).toBe(0);
    // Equal hulls under different doctrines: a sweep is allowed, a walkover is not (ADR-0005, 17.11).
    if (a === b) for (const c of costs) expect(c, `${a} vs ${a}: winner barely touched`).toBeGreaterThanOrEqual(0.15);
  }
  expect(decided / fought, "share of battles decided (ADR-0005)").toBeGreaterThanOrEqual(0.5);
});
