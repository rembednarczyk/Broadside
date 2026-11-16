import { SHIP_CLASSES, crewPrice, plunderValue, priceFactor, repairBill, shipPrice, shipyardStock, tradeInValue } from "@broadside/core";
import { type Entity, type Simulation, condition, portOwner } from "@broadside/sim";
import { type PortHud } from "@broadside/ui";

/** The port the player lies alongside (within reach and nearly stopped), with its prices. */
const ALONGSIDE = 180;

export const presentPort = (sim: Simulation, me: Entity): PortHud | null => {
  const b = me.body!;
  if (Math.hypot(b.vel.x, b.vel.z) > 2) return null;
  const index = sim.ports.findIndex((p) => Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < ALONGSIDE);
  if (index < 0) return null;
  const site = sim.ports[index]!;
  const owner = portOwner(sim.world, index, site);
  const s = me.ship!;
  const def = s.model.def;
  const factor = owner === s.faction ? 0.7 : priceFactor(owner, s.faction, sim.relations);
  const f = factor ?? 1;
  const hullMissing = s.sections.reduce((a, x) => a + (def.sectionHp - x.hp), 0);
  const mastMissing = s.mastHp.reduce((a, hp) => a + (def.mastHp - hp), 0);
  const canvas = s.sailCloth.reduce((a, c) => a + (1 - c), 0) / s.sailCloth.length;
  const area = def.masts.reduce((a, m) => a + m.sails.reduce((x, y) => x + y.area, 0), 0);
  const crewMissing = def.crew - s.crew;
  return {
    index,
    name: site.name,
    owner,
    factor,
    repairCost: repairBill(hullMissing, mastMissing, canvas, area, 1 - s.rigging, def.crew, f).total,
    crewMissing,
    crewCost: crewPrice(crewMissing, f),
    plunderValue: plunderValue(sim.purse.plunder, owner),
    yard: shipyardStock(owner)
      .filter((id) => id !== def.id)
      .map((id) => ({ classId: id, cost: shipPrice(id, f) - tradeInValue(def.id, condition(s)), crew: SHIP_CLASSES[id].crew, guns: SHIP_CLASSES[id].guns.reduce((a, g) => a + (g.kind === "broadside" ? g.count * 2 : g.count), 0) })),
    standings: (["crown", "republic", "empire"] as const).map((faction) => ({ faction, value: sim.relations[faction] })),
  };
};
