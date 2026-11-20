import { Color3, Matrix, Mesh, Quaternion, type Scene, StandardMaterial, type Texture, Vector3, VertexData } from "../babylon";
import { DebrisPool } from "./debris-motion";

/**
 * The flying planks of a hit (debris-motion) drawn as thin instances of one low board (Flyweight):
 * one mesh per kind of planking, so a plank shows the timber of the hull it came out of (the
 * planking baked from the ship's model, HullModels.planks) or the generated hulls' planks. The
 * board is a slab with ragged ends (each corner broken off at its own length), twelve triangles.
 */
const WIDTH = 0.3;
const THICK = 0.08;

const boardData = (): VertexData => {
  // Ends broken off unevenly: the x of each corner at the two ends.
  const ends = [
    [-0.5, -0.38, -0.46, -0.5],
    [0.5, 0.41, 0.5, 0.36],
  ];
  const w = WIDTH / 2;
  const t = THICK / 2;
  const corner = (end: number, k: number): [number, number, number] => [ends[end]![k]!, k < 2 ? t : -t, k % 2 === 0 ? -w : w];
  const quads: [number, number, number, number][] = [];
  const pts: [number, number, number][] = [];
  for (let e = 0; e < 2; e++) for (let k = 0; k < 4; k++) pts.push(corner(e, k));
  // 0..3 one end (top-left, top-right, bottom-left, bottom-right), 4..7 the other.
  quads.push([0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5], [0, 2, 3, 1], [4, 5, 7, 6]);
  const data = new VertexData();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const q of quads) {
    const base = positions.length / 3;
    q.forEach((i, n) => {
      const p = pts[i]!;
      positions.push(...p);
      // The grain along the board.
      uvs.push(p[0] + 0.5, n === 0 || n === 3 ? 0 : 0.25);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  return data;
};

export class PlankDebris {
  readonly pool: DebrisPool;
  private readonly kinds: { texture: Texture | null; mesh: Mesh }[] = [];
  private readonly data = boardData();

  constructor(private readonly scene: Scene, capacity: number) {
    this.pool = new DebrisPool(capacity);
  }

  /** Index of the kind of plank for this texture (null: the plain timber colour), made on first use. */
  kindOf(texture: Texture | null): number {
    const found = this.kinds.findIndex((k) => k.texture === texture);
    if (found >= 0) return found;
    const mesh = new Mesh(`fx-planks-${this.kinds.length}`, this.scene);
    this.data.applyToMesh(mesh);
    const m = new StandardMaterial(`fx-planks-${this.kinds.length}`, this.scene);
    if (texture) {
      m.diffuseTexture = texture;
      m.diffuseColor = new Color3(1.2, 1, 0.8);
    } else m.diffuseColor = new Color3(0.5, 0.36, 0.22);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
    m.backFaceCulling = false;
    mesh.material = m;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.thinInstanceCount = 0;
    this.kinds.push({ texture, mesh });
    return this.kinds.length - 1;
  }

  /** Writes every plank's place into its kind's instances. */
  sync(): void {
    const counts = this.kinds.map(() => 0);
    for (const p of this.pool.pieces) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    const buffers = counts.map((n) => new Float32Array(Math.max(1, n) * 16));
    const filled = this.kinds.map(() => 0);
    const m = new Matrix();
    const q = new Quaternion();
    const s = new Vector3();
    const t = new Vector3();
    for (const p of this.pool.pieces) {
      const k = p.kind;
      if (!this.kinds[k]) continue;
      q.set(p.rot.x, p.rot.y, p.rot.z, p.rot.w);
      s.set(p.length, 0.7 + p.length * 0.3, 0.7 + p.length * 0.3);
      t.set(p.x, p.y, p.z);
      Matrix.ComposeToRef(s, q, t, m);
      m.copyToArray(buffers[k]!, filled[k]! * 16);
      filled[k]!++;
    }
    this.kinds.forEach((kind, i) => {
      kind.mesh.thinInstanceSetBuffer("matrix", buffers[i]!, 16, false);
      kind.mesh.thinInstanceCount = counts[i]!;
    });
  }

  dispose(): void {
    for (const k of this.kinds) k.mesh.dispose();
  }
}
