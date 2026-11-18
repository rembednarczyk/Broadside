import { type GerstnerWave, waterHeight } from "@broadside/core";
import { Color3, Matrix, Mesh, MeshBuilder, type Scene, StandardMaterial, VertexData } from "../babylon";

type P = { readonly x: number; readonly z: number };

/**
 * A flat strip along a polyline on the sea (pure, tested): two vertices a point, offset across the
 * line by half the width (mitred at the corners by averaging the two segments' normals), riding
 * the waves at `height(x, z)`. Indices for a triangle strip as a list.
 */
export const ribbonOnWater = (points: readonly P[], width: number, height: (x: number, z: number) => number): { positions: number[]; indices: number[] } => {
  const positions: number[] = [];
  const indices: number[] = [];
  const n = points.length;
  if (n < 2) return { positions, indices };
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(n - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const p = points[i]!;
    for (const s of [-1, 1]) {
      const x = p.x + nx * s * width * 0.5;
      const z = p.z + nz * s * width * 0.5;
      positions.push(x, height(x, z), z);
    }
    if (i > 0) {
      const k = i * 2;
      indices.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  return { positions, indices };
};

/**
 * Simple steering on the water: the line the player is drawing (bright white), the route the crew
 * is sailing (the ship and the points still to reach, fainter), and a ring on the destination of
 * a tapped course. Unlit, riding the waves like the salvo marks, widened with the isometric zoom
 * so they read at any distance.
 */
export class CourseView {
  private readonly stroke: Mesh;
  private readonly route: Mesh;
  private readonly ring: Mesh;
  private drawing: readonly P[] = [];
  private path: readonly P[] = [];
  private goal: P | null = null;
  visible = true;

  constructor(scene: Scene) {
    const mat = (name: string, alpha: number): StandardMaterial => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true;
      m.emissiveColor = new Color3(0.97, 0.97, 0.94);
      m.alpha = alpha;
      m.backFaceCulling = false;
      return m;
    };
    this.stroke = new Mesh("course-stroke", scene);
    this.stroke.material = mat("course-stroke-mat", 0.9);
    this.route = new Mesh("course-route", scene);
    this.route.material = mat("course-route-mat", 0.45);
    this.ring = MeshBuilder.CreateTorus("course-goal", { diameter: 8, thickness: 0.7, tessellation: 24 }, scene);
    this.ring.material = mat("course-goal-mat", 0.8);
    for (const m of [this.stroke, this.route, this.ring]) {
      m.isPickable = false;
      m.isVisible = false;
    }
  }

  /** The line being drawn (world points, empty: none). */
  setStroke(points: readonly P[]): void {
    this.drawing = points;
  }

  /** The route being sailed: from the ship through the points to come; `goal`: a destination ring. */
  setRoute(points: readonly P[], goal: P | null): void {
    this.path = points;
    this.goal = goal;
  }

  /** `view`: half-height of the frame in metres (the isometric zoom). */
  frame(waves: readonly GerstnerWave[], time: number, view = 60): void {
    const zoom = Math.max(1, view / 60);
    const h = (x: number, z: number): number => waterHeight(waves, x, z, time) + 0.9;
    this.strip(this.stroke, this.visible ? this.drawing : [], 2.2 * zoom, h);
    this.strip(this.route, this.visible ? this.path : [], 1.4 * zoom, h);
    const g = this.visible ? this.goal : null;
    this.ring.isVisible = g !== null;
    if (g) Matrix.Scaling(zoom, zoom, zoom).multiply(Matrix.Translation(g.x, h(g.x, g.z), g.z)).decompose(this.ring.scaling, undefined, this.ring.position);
  }

  private strip(mesh: Mesh, points: readonly P[], width: number, h: (x: number, z: number) => number): void {
    const r = ribbonOnWater(points, width, h);
    mesh.isVisible = r.indices.length > 0;
    if (!mesh.isVisible) return;
    const data = new VertexData();
    data.positions = r.positions;
    data.indices = r.indices;
    data.applyToMesh(mesh, true);
  }

  dispose(): void {
    for (const m of [this.stroke, this.route, this.ring]) m.dispose();
  }
}
