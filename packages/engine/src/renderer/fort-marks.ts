import { type FortClassDef, fortLayout } from "@broadside/core";
import { DynamicTexture, Mesh, type Scene, StandardMaterial, type TransformNode, Vector3, VertexData } from "../babylon";

/**
 * Where shot struck a fort's stone: a pale scar of fresh-broken stone round a dark crater, laid on
 * the face it struck (decals as quads, the shot holes of a ship's hull, shot-holes.ts; Lengyel,
 * "Game Programming Gems 2"). The face is found from the layout itself (core fort-layout: the same
 * walls and towers the simulation tests shot against), not by picking: the nearest wall face or
 * tower side to the point of the hit. One mesh of quads per fort, under its root; the oldest scar
 * gives way at `MAX`.
 */
const MAX = 60;

const scarTexture = (scene: Scene): DynamicTexture => {
  const size = 128;
  const t = new DynamicTexture("fort-scar", { width: size, height: size }, scene, true);
  const c = t.getContext() as CanvasRenderingContext2D;
  c.clearRect(0, 0, size, size);
  let s = 23;
  const rnd = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  // Fresh breaks: pale, ragged, wider than the crater.
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * size * 0.18;
    const g = c.createRadialGradient(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 0, size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, size * (0.12 + rnd() * 0.14));
    g.addColorStop(0, "rgba(205,198,182,0.95)");
    g.addColorStop(1, "rgba(190,182,166,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  }
  // The crater: dark, a little off round, sooty at the lip.
  c.fillStyle = "rgba(40,34,28,1)";
  c.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = size * (0.12 + rnd() * 0.06);
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.fill();
  t.hasAlpha = true;
  t.update();
  return t;
};

const scarMaterial = (scene: Scene): StandardMaterial => {
  const cached = scene.getMaterialByName("fort-scar");
  if (cached) return cached as StandardMaterial;
  const m = new StandardMaterial("fort-scar", scene);
  m.diffuseTexture = scarTexture(scene);
  m.useAlphaFromDiffuseTexture = true;
  m.transparencyMode = 1;
  m.alphaCutOff = 0.35;
  m.specularColor.set(0.02, 0.02, 0.02);
  m.zOffset = -2;
  return m;
};

/** The face of the works nearest a point in fort space: the point on it and its outward normal, or null. */
export const faceAt = (def: FortClassDef, x: number, y: number, z: number): { p: Vector3; n: Vector3 } | null => {
  const l = fortLayout(def);
  let best: { p: Vector3; n: Vector3; err: number } | null = null;
  for (const w of l.walls) {
    const ang = Math.atan2(w.x1 - w.x0, w.z1 - w.z0);
    const mx = (w.x0 + w.x1) / 2;
    const mz = (w.z0 + w.z1) / 2;
    const u = (x - mx) * Math.cos(ang) - (z - mz) * Math.sin(ang);
    const v = (x - mx) * Math.sin(ang) + (z - mz) * Math.cos(ang);
    const half = Math.hypot(w.x1 - w.x0, w.z1 - w.z0) / 2;
    if (Math.abs(v) > half + 1 || y > w.height + 2) continue;
    const err = Math.abs(Math.abs(u) - w.thickness / 2);
    if (best && err >= best.err) continue;
    // Out of the face the ball struck (the outer face, or the inner one for a shot over the walls).
    const across = new Vector3(Math.cos(ang), 0, -Math.sin(ang));
    const sign = u >= 0 ? 1 : -1;
    const n = across.scale(sign);
    best = { p: new Vector3(mx, y, mz).add(across.scale(sign * w.thickness / 2)).add(new Vector3(Math.sin(ang), 0, Math.cos(ang)).scale(Math.max(-half, Math.min(half, v)))), n, err };
  }
  for (const t of l.towers) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (y > t.height + 2 || d < 1e-3) continue;
    const err = Math.abs(d - t.radius);
    if (best && err >= best.err) continue;
    const n = new Vector3((x - t.x) / d, 0, (z - t.z) / d);
    best = { p: new Vector3(t.x, y, t.z).add(n.scale(t.radius)), n, err };
  }
  return best && best.err < 3 ? { p: best.p, n: best.n } : null;
};

export class FortMarks {
  private readonly mesh: Mesh;
  private readonly marks: { p: Vector3; n: Vector3; size: number; twist: number }[] = [];

  constructor(scene: Scene, private readonly root: TransformNode, private readonly def: FortClassDef) {
    this.mesh = new Mesh(`fort-scars-${root.name}`, scene);
    this.mesh.parent = root;
    this.mesh.material = scarMaterial(scene);
    this.mesh.isPickable = false;
  }

  /** Shot struck at this world point; `size` the scar's width (m). */
  add(at: { readonly x: number; readonly y: number; readonly z: number }, size: number): boolean {
    const inv = this.root.computeWorldMatrix(true).clone().invert();
    const local = Vector3.TransformCoordinates(new Vector3(at.x, at.y, at.z), inv);
    const face = faceAt(this.def, local.x, local.y, local.z);
    if (!face) return false;
    if (this.marks.length >= MAX) this.marks.shift();
    this.marks.push({ p: face.p.add(face.n.scale(0.04)), n: face.n, size, twist: (Math.abs(local.x * 3.7 + local.y * 5.1 + local.z * 1.3) % 1) * Math.PI * 2 });
    this.rebuild();
    return true;
  }

  private rebuild(): void {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (const h of this.marks) {
      const along = Vector3.Cross(Vector3.Up(), h.n).normalize();
      const up = Vector3.Cross(h.n, along).normalize();
      const c = Math.cos(h.twist);
      const s = Math.sin(h.twist);
      const u = along.scale(c).add(up.scale(s)).scale(h.size / 2);
      const v = up.scale(c).subtract(along.scale(s)).scale(h.size / 2);
      const base = positions.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const q = h.p.add(u.scale(a)).add(v.scale(b));
        positions.push(q.x, q.y, q.z);
        normals.push(h.n.x, h.n.y, h.n.z);
        uvs.push((a + 1) / 2, (b + 1) / 2);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.uvs = uvs;
    data.indices = indices;
    data.applyToMesh(this.mesh, true);
    this.mesh.computeWorldMatrix(true);
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
