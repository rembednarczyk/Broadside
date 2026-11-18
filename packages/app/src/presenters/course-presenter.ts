import { type Simulation } from "@broadside/sim";

type P = { x: number; z: number };

/** What a mark on the water stands for: a destination, a ship to board or follow, a fort to storm, a port to put into. */
export type CourseMark = "go" | "board" | "follow" | "engage" | "storm" | "dock";

export interface CourseHud {
  /** From the ship through the points to come (or to the ship or fort in hand). */
  readonly path: P[];
  /** Ring on the destination or on the ship or fort the order is about (a drawn course has none). */
  readonly goal: (P & { readonly kind: CourseMark; readonly size: number }) | null;
}

/** Within this distance of a port's approach a destination is that port (the crew puts in). */
const AT_PORT = 30;

/** The crew's order (simple steering) for the water overlay. */
export const presentCourse = (sim: Simulation, playerId: number): CourseHud => {
  const me = sim.byId(playerId);
  const o = me?.pilot?.order;
  if (!me?.body || !o) return { path: [], goal: null };
  const from = { x: me.body.pos.x, z: me.body.pos.z };
  switch (o.kind) {
    case "route": {
      if (o.route.length === 0) return { path: [], goal: null };
      const path = [from, ...o.route.map((p) => ({ x: p.x, z: p.z }))];
      const end = path[path.length - 1]!;
      const port = sim.ports.some((p) => Math.hypot(p.ax - end.x, p.az - end.z) < AT_PORT);
      return { path, goal: o.hold ? null : { ...end, kind: port ? "dock" : "go", size: 1 } };
    }
    case "board":
    case "follow":
    case "engage": {
      const t = sim.byId(o.target);
      if (!t?.body || !t.ship) return { path: [], goal: null };
      const at = { x: t.body.pos.x, z: t.body.pos.z };
      return { path: [from, at], goal: { ...at, kind: o.kind, size: t.ship.model.def.hull.length / 12 } };
    }
    case "assault": {
      const f = sim.forts().find((x) => x.id === o.fort)?.fort;
      if (!f) return { path: [], goal: null };
      const at = { x: f.site.x, z: f.site.z };
      return { path: [from, at], goal: { ...at, kind: "storm", size: f.def.radius / 8 } };
    }
  }
};
