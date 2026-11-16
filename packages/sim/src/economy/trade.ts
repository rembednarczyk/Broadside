import { type GameCommand, type PortSite, ammoPrice, crewPrice, plunderValue, priceFactor, provisionsPrice, repairBill, shipPrice, shipyardStock, tradeInValue } from "@broadside/core";
import { changeShip, condition } from "./shipyard";
import { type ShipEntity } from "../commands/handler";
import { type SimContext } from "../systems/context";
import { credit } from "./purse";
import { type SimWorld } from "../world/world";

/**
 * Port services (the rules live in core/economy; this applies them to a ship alongside). The port
 * belongs to whoever holds the fort guarding it.
 */
const ALONGSIDE = 180;
const MAX_SPEED = 2;

export const portOwner = (world: SimWorld, index: number, site: PortSite): PortSite["faction"] => {
  for (const f of world.with("fort")) if (f.fort.site.port === index) return f.fort.faction;
  return site.faction;
};

type Trade = Extract<GameCommand, { type: "trade" }>;

const refuse = (ctx: SimContext, port: number, reason: "hostile" | "far" | "gold"): void => {
  ctx.events.push({ type: "tradeRefused", port, reason });
};

export const trade = (e: ShipEntity, cmd: Trade, ctx: SimContext): void => {
  const site = ctx.ports[cmd.port];
  const purse = ctx.purse;
  if (!site || !purse) return;
  const b = e.body;
  if (Math.hypot(b.pos.x - site.x, b.pos.z - site.z) > ALONGSIDE || Math.hypot(b.vel.x, b.vel.z) > MAX_SPEED) return refuse(ctx, cmd.port, "far");
  const owner = portOwner(ctx.world, cmd.port, site);
  const factor = owner === e.ship.faction ? 0.7 : priceFactor(owner, e.ship.faction, ctx.relations);
  if (factor === null) return refuse(ctx, cmd.port, "hostile");
  const s = e.ship;
  const pay = (cost: number): boolean => {
    if (cost > purse.gold) {
      refuse(ctx, cmd.port, "gold");
      return false;
    }
    purse.gold -= cost;
    return true;
  };
  switch (cmd.service) {
    case "ammo": {
      const ammo = cmd.ammo ?? "round";
      if (pay(ammoPrice(ammo, cmd.qty, factor))) s.stores[ammo] = (s.stores[ammo] ?? 0) + cmd.qty;
      return;
    }
    case "crew": {
      const men = Math.min(cmd.qty, s.model.def.crew - s.crew);
      if (men > 0 && pay(crewPrice(men, factor))) s.crew += men;
      return;
    }
    case "provisions": {
      if (pay(provisionsPrice(s.crew, cmd.qty, factor))) purse.provisions += cmd.qty;
      return;
    }
    case "repair": {
      const def = s.model.def;
      const hullMissing = s.sections.reduce((a, x) => a + (def.sectionHp - x.hp), 0);
      const mastMissing = s.mastHp.reduce((a, hp) => a + (def.mastHp - hp), 0);
      const canvas = s.sailCloth.reduce((a, c) => a + (1 - c), 0) / s.sailCloth.length;
      const area = def.masts.reduce((a, m) => a + m.sails.reduce((x, y) => x + y.area, 0), 0);
      const bill = repairBill(hullMissing, mastMissing, canvas, area, 1 - s.rigging, def.crew, factor);
      if (bill.total > 0 && pay(bill.total)) {
        for (const sec of s.sections) Object.assign(sec, { hp: def.sectionHp, leak: 0, water: 0, fire: 0 });
        s.mastHp = s.mastHp.map(() => def.mastHp);
        s.sailCloth = s.sailCloth.map(() => 1);
        s.rigging = 1;
        s.guns.forEach((g) => (g.dismounted = false));
      }
      return;
    }
    case "buyShip": {
      const id = cmd.classId;
      if (!id || id === s.model.def.id || !shipyardStock(owner).includes(id)) return;
      // A smaller hull than the one traded in pays the captain the difference.
      const net = shipPrice(id, factor) - tradeInValue(s.model.def.id, condition(s));
      if (net < 0) credit(purse, ctx.events, -net, "trade");
      if (net < 0 || pay(net)) changeShip(e, id);
      return;
    }
    case "sellPlunder": {
      const value = plunderValue(purse.plunder, owner);
      purse.plunder = 0;
      credit(purse, ctx.events, value, "trade");
      return;
    }
  }
};
