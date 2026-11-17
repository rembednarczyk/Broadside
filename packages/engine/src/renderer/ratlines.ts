import { type ShipModel } from "@broadside/sim";
import { Color3, type LinesMesh, MeshBuilder, type Scene, type TransformNode, Vector3 } from "../babylon";
import { beamAt, deckAt } from "./hull-stations";
import { type MastBend, bendShare } from "./rig-motion";

/**
 * Shrouds with ratlines (rungs every 0.55 m between neighbouring shrouds, a ladder net), moving with
 * the rig: the heads follow the bent mast (rig-motion), the feet stay on the channels. Under load the
 * windward shrouds carry the mast and stand straight while the leeward ones go slack and bow out
 * (the standing behaviour of a real rig; slack drawn as a parabola like the stays). The rungs are
 * seized to the shrouds, so they are interpolated along the bent shrouds.
 */
interface Shroud {
  readonly foot: readonly [number, number, number];
  readonly head: readonly [number, number, number];
}
interface Ladder {
  readonly mast: number;
  readonly side: -1 | 1;
  readonly shrouds: readonly Shroud[];
  readonly rungs: number;
}

/** Bow of a slack shroud at mid-length as a share of its length (2.5%), and of a taut one. */
const SLACK = 0.025;
const TAUT = 0.003;
const SEGMENTS = 6;

export class Ratlines {
  private readonly ladders: Ladder[] = [];
  private readonly mesh: LinesMesh;

  constructor(scene: Scene, parent: TransformNode, model: ShipModel) {
    const h = model.def.hull;
    model.def.masts.forEach((m, mast) => {
      const topY = h.freeboard + m.height * 0.58;
      for (const side of [-1, 1] as const) {
        const shrouds = [-1.6, -0.55, 0.55, 1.6].map((dz): Shroud => ({ foot: [side * (beamAt(h, m.z) + 0.35), deckAt(h, m.z) + 0.9, m.z + dz], head: [side * 0.45, topY, m.z + dz * 0.25] }));
        this.ladders.push({ mast, side, shrouds, rungs: Math.floor((topY - deckAt(h, m.z) - 1) / 0.55) });
      }
    });
    this.mesh = MeshBuilder.CreateLineSystem("ratlines", { lines: this.lines([], [], 0), updatable: true }, scene);
    this.mesh.color = new Color3(0.08, 0.06, 0.05);
    this.mesh.parent = parent;
    this.mesh.isPickable = false;
  }

  /** `lee`: -1..1 side the sails push to (starboard +), as given to the mast springs. */
  update(bends: readonly MastBend[], loads: readonly number[], lee: number): void {
    if (!this.mesh.isEnabled()) return;
    MeshBuilder.CreateLineSystem(this.mesh.name, { lines: this.lines(bends, loads, lee), instance: this.mesh });
  }

  private lines(bends: readonly MastBend[], loads: readonly number[], lee: number): Vector3[][] {
    const out: Vector3[][] = [];
    for (const l of this.ladders) {
      const bend = bends[l.mast];
      const load = Math.min(1, Math.max(0, loads[l.mast] ?? 0));
      // Leeward shrouds slacken with the load; windward ones are drawn straight.
      const leeward = Math.max(0, l.side * lee);
      const bow = TAUT + (SLACK - TAUT) * Math.min(1, load * leeward * 1.5);
      const polys = l.shrouds.map((s) => {
        const k = bend ? bendShare(bend, s.head[1]) : 0;
        const hx = s.head[0] + (bend ? bend.dx * k : 0);
        const hz = s.head[2] + (bend ? bend.dz * k : 0);
        const len = Math.hypot(hx - s.foot[0], s.head[1] - s.foot[1], hz - s.foot[2]);
        const pts: Vector3[] = [];
        for (let i = 0; i <= SEGMENTS; i++) {
          const t = i / SEGMENTS;
          const bulge = l.side * bow * len * 4 * t * (1 - t);
          pts.push(new Vector3(s.foot[0] + (hx - s.foot[0]) * t + bulge, s.foot[1] + (s.head[1] - s.foot[1]) * t, s.foot[2] + (hz - s.foot[2]) * t));
        }
        return pts;
      });
      out.push(...polys);
      for (let r = 1; r < l.rungs; r++) out.push(polys.map((p) => along(p, r / l.rungs)));
    }
    return out;
  }
}

/** Point at parameter t (0..1) along a polyline of equal steps in t. */
const along = (p: readonly Vector3[], t: number): Vector3 => {
  const f = t * (p.length - 1);
  const i = Math.min(p.length - 2, Math.floor(f));
  return Vector3.Lerp(p[i]!, p[i + 1]!, f - i);
};
