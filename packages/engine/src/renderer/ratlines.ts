import { type ShipModel } from "@broadside/sim";
import { Color3, type LinesMesh, Matrix, MeshBuilder, Quaternion, type Scene, type StandardMaterial, type TransformNode, Vector3 } from "../babylon";
import { type SideProfile } from "./side-profile";
import { type MastBend, bendShare } from "./rig-motion";
import { RopeTubes } from "./rope-tubes";
import { type ShroudLadder, shroudLadders } from "./rig-layout";

/**
 * Shrouds with ratlines (rungs every 0.55 m between neighbouring shrouds, a ladder net), moving with
 * the rig: the heads follow the bent mast (rig-motion), the feet stay on the channels. Under load the
 * windward shrouds carry the mast and stand straight while the leeward ones go slack and bow out
 * (the standing behaviour of a real rig; slack drawn as a parabola like the stays). The rungs are
 * seized to the shrouds, so they are interpolated along the bent shrouds.
 */
/** Bow of a slack shroud at mid-length as a share of its length (2.5%), and of a taut one. */
const SLACK = 0.025;
const TAUT = 0.003;
const SEGMENTS = 6;

export class Ratlines {
  private readonly ladders: readonly ShroudLadder[];
  private readonly mesh: LinesMesh;
  /** The shrouds themselves as laid rope (the rungs between them stay thin lines, as ratline stuff is). */
  private readonly tubes: RopeTubes;

  /** `side`: the measured side of a modelled hull; the shrouds then come down to channels on it. */
  constructor(scene: Scene, parent: TransformNode, model: ShipModel, side: SideProfile | null = null, iron: StandardMaterial | null = null) {
    this.ladders = shroudLadders(model, side);
    if (side && iron) this.channels(scene, parent, iron);
    this.tubes = new RopeTubes(scene, parent, "shroud-ropes", this.ladders.length * 4, SEGMENTS + 1, 0.032);
    this.mesh = MeshBuilder.CreateLineSystem("ratlines", { lines: this.lines([], [], 0), updatable: true }, scene);
    this.mesh.color = new Color3(0.08, 0.06, 0.05);
    this.mesh.parent = parent;
    this.mesh.isPickable = false;
  }

  /**
   * Channels and deadeyes: the plank that holds the shrouds off the side, and under each shroud the
   * pair of deadeyes it is set up with (thin instances of one box and one disc: Flyweight).
   */
  private channels(scene: Scene, parent: TransformNode, iron: StandardMaterial): void {
    const plank = MeshBuilder.CreateBox("channels", { width: 0.5, height: 0.09, depth: 4 }, scene);
    const eye = MeshBuilder.CreateCylinder("deadeyes", { height: 0.1, diameter: 0.3, tessellation: 10 }, scene);
    const planks: Matrix[] = [];
    const eyes: Matrix[] = [];
    // A deadeye faces outboard: its axis (the cylinder's Y) lies across the ship.
    const turn = Quaternion.RotationAxis(Vector3.Forward(), Math.PI / 2);
    for (const l of this.ladders) {
      const f = l.shrouds[0]!.foot;
      const z = (l.shrouds[0]!.foot[2] + l.shrouds[l.shrouds.length - 1]!.foot[2]) / 2;
      planks.push(Matrix.Translation(f[0] - l.side * 0.12, f[1] - 0.05, z));
      for (const s of l.shrouds) {
        for (const up of [0.18, 0.62]) eyes.push(Matrix.Compose(Vector3.One(), turn, new Vector3(s.foot[0] + (s.head[0] - s.foot[0]) * (up / 20), s.foot[1] + up, s.foot[2])));
      }
    }
    for (const [mesh, list] of [[plank, planks], [eye, eyes]] as const) {
      const buf = new Float32Array(list.length * 16);
      list.forEach((m, i) => m.copyToArray(buf, i * 16));
      mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
      mesh.material = iron;
      mesh.parent = parent;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
    }
  }

  /** `lee`: -1..1 side the sails push to (starboard +), as given to the mast springs. */
  update(bends: readonly MastBend[], loads: readonly number[], lee: number): void {
    if (!this.mesh.isEnabled()) return;
    MeshBuilder.CreateLineSystem(this.mesh.name, { lines: this.lines(bends, loads, lee), instance: this.mesh });
  }

  private lines(bends: readonly MastBend[], loads: readonly number[], lee: number): Vector3[][] {
    const out: Vector3[][] = [];
    const ropes: [number, number, number][][] = [];
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
      ropes.push(...polys.map((p) => p.map((q): [number, number, number] => [q.x, q.y, q.z])));
      for (let r = 1; r < l.rungs; r++) out.push(polys.map((p) => along(p, r / l.rungs)));
    }
    this.tubes?.update(ropes);
    return out;
  }
}

/** Point at parameter t (0..1) along a polyline of equal steps in t. */
const along = (p: readonly Vector3[], t: number): Vector3 => {
  const f = t * (p.length - 1);
  const i = Math.min(p.length - 2, Math.floor(f));
  return Vector3.Lerp(p[i]!, p[i + 1]!, f - i);
};
