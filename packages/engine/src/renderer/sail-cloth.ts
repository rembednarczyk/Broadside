import { Matrix, Mesh, MeshBuilder, Quaternion, type Scene, type StandardMaterial, type TransformNode, Vector3, VertexData, type ShadowGenerator } from "../babylon";
import { SAIL_COLS, SAIL_ROWS, sailIndices, sailPositions, sailUvs } from "./sail-geometry";
import { type SailPlan } from "./rig-plan";
import { type MastBend, bendShare, flutterOffset } from "./rig-motion";
import { SailSim } from "./sail-sim";

/**
 * All the canvas of one ship in one dynamic mesh per material, and all its yards as thin
 * instances of one cylinder (Batching: from ~20 draw calls per ship to 3). Each sail is computed
 * in its own space, then rotated by its trim and placed at its mast on the CPU each frame.
 */
const VERTS = (SAIL_COLS + 1) * (SAIL_ROWS + 1);

/** Integer hash to 0..1 (Wang-style mixing): which cells of a sail are shot through first. */
const holeHash = (plan: number, cell: number): number => {
  let h = (plan * 374761393 + cell * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export interface SailState {
  /** Rotation of the sail about its mast (radians, Babylon's rotation.y convention). */
  readonly angle: number;
  /** 0..1 how much of this canvas is spread. */
  readonly set: number;
  /** Signed billow. */
  readonly billow: number;
  readonly visible: boolean;
  /** 0..1 how hard the canvas shakes (luffing, see rig-motion). */
  readonly flutter: number;
}

interface Group {
  readonly mesh: Mesh;
  readonly plans: SailPlan[];
  readonly indexOf: number[];
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: number[];
}

export class SailCloth {
  private readonly groups: Group[] = [];
  private readonly yards: Mesh;
  private readonly yardPlans: { plan: SailPlan; index: number; length: number }[] = [];
  private readonly local = new Float32Array(VERTS * 3);
  private readonly yardBuf: Float32Array;
  /** Cloth simulation per plan, made when the ship first comes close (sail-sim). */
  private readonly sims: (SailSim | null)[];
  private simulated = false;
  /** Holes shown per plan (quantised damage), to rebuild indices only when it changes. */
  private readonly torn: number[];

  constructor(scene: Scene, parent: TransformNode, name: string, plans: readonly SailPlan[], materialFor: (p: SailPlan) => StandardMaterial, wood: StandardMaterial, shadows: ShadowGenerator | null) {
    const byMat = new Map<StandardMaterial, number[]>();
    plans.forEach((p, i) => {
      const m = materialFor(p);
      byMat.set(m, [...(byMat.get(m) ?? []), i]);
    });
    for (const [mat, idx] of byMat) {
      const n = idx.length;
      const positions = new Float32Array(n * VERTS * 3);
      const uvs: number[] = [];
      const indices: number[] = [];
      const base = sailIndices();
      const uv = sailUvs();
      for (let k = 0; k < n; k++) {
        uvs.push(...uv);
        for (const i of base) indices.push(i + k * VERTS);
      }
      const mesh = new Mesh(`${name}-sails`, scene);
      const data = new VertexData();
      data.positions = positions;
      data.indices = indices;
      data.uvs = uvs;
      data.normals = new Float32Array(positions.length);
      data.applyToMesh(mesh, true);
      mesh.material = mat;
      mesh.parent = parent;
      mesh.alwaysSelectAsActiveMesh = true;
      shadows?.addShadowCaster(mesh);
      this.groups.push({ mesh, plans: idx.map((i) => plans[i]!), indexOf: idx, positions, normals: new Float32Array(positions.length), indices });
    }
    this.yards = MeshBuilder.CreateCylinder(`${name}-yards`, { height: 1, diameter: 1, tessellation: 6 }, scene);
    this.yards.material = wood;
    this.yards.parent = parent;
    this.yards.alwaysSelectAsActiveMesh = true;
    plans.forEach((p, i) => {
      if (p.yard) this.yardPlans.push({ plan: p, index: i, length: p.shape === "square" ? p.width * 1.18 : p.width });
    });
    this.yardBuf = new Float32Array(this.yardPlans.length * 16);
    this.torn = plans.map(() => 0);
    this.sims = plans.map(() => null);
  }

  /**
   * Shot holes: as the canvas of a mast is shot away, cells of its sails drop out in a fixed
   * pattern per sail (an integer hash, so the same damage always shows the same holes). The
   * edge cells stay (the bolt ropes), so the sail keeps its outline and hangs from its yard.
   */
  setDamage(clothByMast: readonly number[]): void {
    for (const g of this.groups) {
      let dirty = false;
      g.plans.forEach((p, k) => {
        const level = Math.round((1 - (clothByMast[p.mast] ?? 1)) * 10);
        if (level !== this.torn[g.indexOf[k]!]) dirty = true;
      });
      if (!dirty) continue;
      const base = sailIndices();
      const indices: number[] = [];
      g.plans.forEach((p, k) => {
        const plan = g.indexOf[k]!;
        const level = Math.round((1 - (clothByMast[p.mast] ?? 1)) * 10);
        this.torn[plan] = level;
        const cut = level * 0.05;
        for (let q = 0; q < SAIL_COLS * SAIL_ROWS; q++) {
          const row = Math.floor(q / SAIL_COLS);
          const col = q % SAIL_COLS;
          // Bolt ropes hold the edges: holes are shot through the body of the canvas.
          const inner = row > 0 && row < SAIL_ROWS - 1 && col > 0 && col < SAIL_COLS - 1;
          // A hole is a cell of degenerate triangles: the index buffer keeps its length, so the
          // mesh's draw range stays valid.
          const hole = inner && holeHash(plan, q) < cut;
          for (let j = 0; j < 6; j++) indices.push((hole ? base[q * 6]! : base[q * 6 + j]!) + k * VERTS);
        }
      });
      g.indices.splice(0, g.indices.length, ...indices);
      g.mesh.updateIndices(indices);
    }
  }

  /**
   * `states[i]` belongs to `plans[i]` of the constructor; `bends[mast]` carries the canvas with its mast.
   * `cloth`: simulate the canvas as fabric (close ships) with the frame's `dt` and the apparent
   * `wind` speed; otherwise the sail takes its analytic shape (distant ships).
   */
  update(states: readonly SailState[], bends: readonly MastBend[] = [], time = 0, cloth: { dt: number; wind: number } | null = null): void {
    // Coming close, the cloth starts from the flat sail and fills within a second.
    const starting = cloth !== null && !this.simulated;
    this.simulated = cloth !== null;
    for (const g of this.groups) {
      g.plans.forEach((p, k) => {
        const st = states[g.indexOf[k]!]!;
        const off = k * VERTS * 3;
        if (!st.visible) {
          g.positions.fill(0, off, off + VERTS * 3);
          return;
        }
        if (cloth) {
          const plan = g.indexOf[k]!;
          const sim = (this.sims[plan] ??= new SailSim(p));
          if (starting) sim.reset(st.set);
          sim.advance(cloth.dt, st.set, st.billow, cloth.wind, st.flutter);
          this.local.set(sim.positions);
        } else sailPositions(p, st.set, st.billow, this.local);
        if (!cloth && st.flutter > 0.01) {
          for (let r = 0; r <= SAIL_ROWS; r++) {
            for (let c = 0; c <= SAIL_COLS; c++) {
              const i = (r * (SAIL_COLS + 1) + c) * 3;
              this.local[i] = this.local[i]! + flutterOffset(st.flutter, p.width, c / SAIL_COLS, r / SAIL_ROWS, time);
            }
          }
        }
        const bend = bends[p.mast];
        const c = Math.cos(st.angle);
        const s = Math.sin(st.angle);
        for (let v = 0; v < VERTS; v++) {
          const x = this.local[v * 3]!;
          const y = this.local[v * 3 + 1]!;
          const z = this.local[v * 3 + 2]!;
          const k = bend ? bendShare(bend, y + p.nodeY) : 0;
          g.positions[off + v * 3] = x * c + z * s + (bend ? bend.dx * k : 0);
          g.positions[off + v * 3 + 1] = y + p.nodeY;
          g.positions[off + v * 3 + 2] = -x * s + z * c + p.nodeZ + (bend ? bend.dz * k : 0);
        }
      });
      VertexData.ComputeNormals(g.positions, g.indices, g.normals);
      g.mesh.updateVerticesData("position", g.positions);
      g.mesh.updateVerticesData("normal", g.normals);
    }
    this.yardPlans.forEach((y, k) => {
      const st = states[y.index]!;
      const p = y.plan;
      const local = p.shape === "square" ? new Vector3(0, p.foot + p.height, 0) : new Vector3(0, p.foot, -p.width / 2);
      const rot = Quaternion.RotationYawPitchRoll(st.angle, Math.PI / 2, 0);
      const pos = Vector3.TransformCoordinates(local, Matrix.RotationY(st.angle)).add(new Vector3(0, p.nodeY, p.nodeZ));
      const bend = bends[p.mast];
      if (bend) {
        const k = bendShare(bend, pos.y);
        pos.addInPlaceFromFloats(bend.dx * k, 0, bend.dz * k);
      }
      const d = st.visible || p.shape === "square" ? 0.12 + p.width * 0.012 : 0;
      Matrix.Compose(new Vector3(d, y.length, d), rot, pos).copyToArray(this.yardBuf, k * 16);
    });
    if (this.yardPlans.length) this.yards.thinInstanceSetBuffer("matrix", this.yardBuf, 16, false);
  }
}
