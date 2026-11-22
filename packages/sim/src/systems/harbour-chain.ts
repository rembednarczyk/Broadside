import { type EventQueue, type FortSite, type Relations, isHostile, standing, vec3 } from "@broadside/core";
import { type System } from "./context";
import { type Entity, type FortState } from "../world/components";
import { sortedById } from "../world/world";

/**
 * Harbour chains (a boom of chain on log floats across a harbour's mouth, raised by the fort that
 * guards it: Cartagena de Indias, 1741; Havana): a ship hostile to the fort's owner (or one that
 * fired on it) cannot cross the line while the chain is up; she is held against it as against a
 * wall (her motion across the line is taken out, as a contact constraint). Friends pass (the
 * chain is lowered for them). The chain falls when the fort is silenced (its windlass crew driven
 * off) or is parted by shot (`shotOnChain`).
 */
type Chain = NonNullable<FortSite["chain"]>;

/** Signed distance of a point from the chain's line, its side, and how far along it (0..1 within the boom). */
const sideOf = (c: Chain, x: number, z: number): { dist: number; side: number; along: number } => {
  const dx = c.x1 - c.x0;
  const dz = c.z1 - c.z0;
  const len2 = dx * dx + dz * dz || 1;
  const dist = (dx * (z - c.z0) - dz * (x - c.x0)) / Math.sqrt(len2);
  return { dist, side: Math.sign(dist), along: ((x - c.x0) * dx + (z - c.z0) * dz) / len2 };
};

export const chainUp = (f: FortState): boolean => !!f.site.chain && f.chain > 0 && !f.silenced;

const barred = (f: FortState, ship: Entity, rel: Relations): boolean => ship.id === f.provokedBy || isHostile(standing(f.faction, ship.ship!.faction, rel));

export const harbourChainSystem: System = (ctx, dt) => {
  const forts = sortedById(ctx.world.with("fort")).filter((e) => chainUp(e.fort!));
  if (forts.length === 0) return;
  for (const e of sortedById(ctx.world.with("ship", "body"))) {
    const b = e.body;
    for (const fe of forts) {
      const f = fe.fort!;
      const c = f.site.chain!;
      if (!barred(f, e, ctx.relations)) continue;
      const now = sideOf(c, b.pos.x, b.pos.z);
      const was = sideOf(c, b.pos.x - b.vel.x * dt, b.pos.z - b.vel.z * dt);
      if (now.side === was.side || now.side === 0 || now.along < -0.02 || now.along > 1.02) continue;
      // Back to her side of the line, her motion across it taken out (along it she may still slide).
      const dx = c.x1 - c.x0;
      const dz = c.z1 - c.z0;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const vn = b.vel.x * nx + b.vel.z * nz;
      b.pos = { ...b.pos, x: b.pos.x - b.vel.x * dt, z: b.pos.z - b.vel.z * dt };
      b.vel = { ...b.vel, x: b.vel.x - vn * nx, z: b.vel.z - vn * nz };
      if (ctx.env.time - f.barredAt > 5) {
        f.barredAt = ctx.env.time;
        ctx.events.push({ type: "chainBarred", fort: fe.id, ship: e.id, at: vec3(b.pos.x, 0, b.pos.z) });
      }
    }
  }
};

/** A ball crossing a raised chain low over the water strikes it; true when it did (the ball is spent). */
export const shotOnChain = (events: EventQueue, forts: readonly Entity[], from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, owner: number, ammo: string): boolean => {
  for (const fe of forts) {
    const f = fe.fort!;
    if (!chainUp(f) || fe.id === owner) continue;
    const c = f.site.chain!;
    const a = sideOf(c, from.x, from.z);
    const b = sideOf(c, to.x, to.z);
    if (a.side === b.side || a.side === 0) continue;
    const t = a.dist / (a.dist - b.dist);
    const along = a.along + (b.along - a.along) * t;
    const y = from.y + (to.y - from.y) * t;
    if (along < 0 || along > 1 || y > 2.5) continue;
    f.chain = Math.max(0, f.chain - (ammo === "chain" ? 3 : 1));
    events.push({ type: "ricochet", at: vec3(from.x + (to.x - from.x) * t, 0, from.z + (to.z - from.z) * t) });
    if (f.chain === 0) events.push({ type: "chainBroken", fort: fe.id, by: owner });
    return true;
  }
  return false;
};

