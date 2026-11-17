import { type ShipClassId, vec3 } from "@broadside/core";
import { type ShipEntity } from "../commands/handler";
import { createBody } from "../physics/rigid-body";
import { shipModel } from "../ship/ship-model";
import { type ShipState, createShipState } from "../ship/ship-state";

/** Share of hull and masts left (prices the part exchange). */
export const condition = (s: ShipState): number => {
  const def = s.model.def;
  const hull = s.sections.reduce((a, x) => a + x.hp, 0) / (def.sectionHp * s.sections.length);
  const masts = s.mastHp.length ? s.mastHp.reduce((a, x) => a + x, 0) / (def.mastHp * s.mastHp.length) : 1;
  return hull * 0.7 + masts * 0.3;
};

/**
 * Moves the captain into a new hull at the same mooring: the entity keeps its id (commands, the
 * camera and saves follow it), the crew comes along up to the new complement, the shot locker is
 * carried across. A fresh body, because mass and inertia belong to the class.
 */
export const changeShip = (e: ShipEntity, classId: ShipClassId): void => {
  const old = e.ship;
  const model = shipModel(classId);
  const next = createShipState(model, old.faction, 0);
  next.crew = Math.min(old.crew, model.def.crew);
  for (const [k, v] of Object.entries(old.stores)) next.stores[k as keyof typeof next.stores] = v;
  e.ship = next;
  e.body = createBody(model.mass, model.inertia, vec3(e.body.pos.x, model.com.y, e.body.pos.z), e.body.rot);
};
