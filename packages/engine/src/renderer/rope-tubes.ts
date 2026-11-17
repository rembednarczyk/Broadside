import { DynamicTexture, Mesh, type Scene, StandardMaterial, type TransformNode, Color3, VertexData } from "../babylon";

/**
 * Ropes with thickness: all the lines of one kind on a ship (the stays, or the shrouds) as one mesh
 * of tubes swept along their polylines (a generalised cylinder: a ring of vertices around each
 * point, in the plane across the rope), rebuilt on the CPU when the rig moves. One draw call per
 * kind and ship; the thin line systems stay for the distance, where a tube is thinner than a pixel.
 */
const SIDES = 5;

/**
 * Tarred hemp, laid right-handed: strands run diagonally round the rope. Painted once (the same
 * for every rope: Flyweight) as a small tiling texture.
 */
export const ropeMaterial = (scene: Scene): StandardMaterial => {
  const cached = scene.getMaterialByName("rope-laid");
  if (cached) return cached as StandardMaterial;
  const size = 64;
  const tex = new DynamicTexture("rope-laid-tex", { width: size, height: size }, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  c.fillStyle = "rgb(52,43,33)";
  c.fillRect(0, 0, size, size);
  // Three strands to a turn: light crowns and dark grooves on the diagonal, wrapping at the edges.
  for (let k = -size; k < size * 2; k += size / 3) {
    for (const [off, w, col] of [[0, 9, "rgb(96,82,62)"], [9, 5, "rgb(70,59,45)"], [16, 5, "rgb(24,19,14)"]] as const) {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(k + off, 0);
      c.lineTo(k + off + size, size);
      c.stroke();
    }
  }
  tex.update(true);
  const m = new StandardMaterial("rope-laid", scene);
  m.diffuseTexture = tex;
  m.diffuseColor = new Color3(0.75, 0.7, 0.62);
  m.specularColor = new Color3(0.04, 0.04, 0.03);
  return m;
};

export class RopeTubes {
  readonly mesh: Mesh;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;

  /** `count` ropes of `points` points each; `radius` in metres. The first `update` gives them shape. */
  constructor(scene: Scene, parent: TransformNode, name: string, private readonly count: number, private readonly points: number, private readonly radius: number) {
    const verts = count * points * (SIDES + 1);
    this.positions = new Float32Array(verts * 3);
    this.normals = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const indices: number[] = [];
    const ring = SIDES + 1;
    for (let r = 0; r < count; r++) {
      for (let p = 0; p < points; p++) {
        for (let s = 0; s <= SIDES; s++) {
          const v = (r * points + p) * ring + s;
          uvs[v * 2] = s / SIDES;
          // The lay repeats a dozen times between two points of a rope (segments of a few metres).
          uvs[v * 2 + 1] = p * 12;
        }
        if (p === points - 1) continue;
        for (let s = 0; s < SIDES; s++) {
          const a = (r * points + p) * ring + s;
          indices.push(a, a + ring, a + 1, a + 1, a + ring, a + ring + 1);
        }
      }
    }
    this.mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.normals = this.normals;
    data.uvs = uvs;
    data.indices = indices;
    data.applyToMesh(this.mesh, true);
    this.mesh.material = ropeMaterial(scene);
    this.mesh.parent = parent;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
  }

  /** `paths[r][p]`: the points of each rope as [x, y, z]; rings are swept across the local direction. */
  update(paths: readonly (readonly (readonly [number, number, number])[])[]): void {
    if (!this.mesh.isEnabled()) return;
    const ring = SIDES + 1;
    for (let r = 0; r < this.count; r++) {
      const path = paths[r]!;
      for (let p = 0; p < this.points; p++) {
        const a = path[Math.max(0, p - 1)]!;
        const b = path[Math.min(this.points - 1, p + 1)]!;
        let tx = b[0] - a[0];
        let ty = b[1] - a[1];
        let tz = b[2] - a[2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        // A side vector across the rope: the tangent crossed with up (or with x for a vertical rope).
        const vertical = Math.abs(ty) > 0.95;
        let nx = vertical ? 0 : -tz;
        let ny = vertical ? tz : 0;
        let nz = vertical ? -ty : tx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const bx = ty * nz - tz * ny;
        const by = tz * nx - tx * nz;
        const bz = tx * ny - ty * nx;
        const c = path[p]!;
        for (let s = 0; s <= SIDES; s++) {
          const ang = (s / SIDES) * Math.PI * 2;
          const cs = Math.cos(ang);
          const sn = Math.sin(ang);
          const i = ((r * this.points + p) * ring + s) * 3;
          const dx = nx * cs + bx * sn;
          const dy = ny * cs + by * sn;
          const dz = nz * cs + bz * sn;
          this.normals[i] = dx;
          this.normals[i + 1] = dy;
          this.normals[i + 2] = dz;
          this.positions[i] = c[0] + dx * this.radius;
          this.positions[i + 1] = c[1] + dy * this.radius;
          this.positions[i + 2] = c[2] + dz * this.radius;
        }
      }
    }
    this.mesh.updateVerticesData("position", this.positions);
    this.mesh.updateVerticesData("normal", this.normals);
  }
}
