import { type GerstnerWave, waterHeight } from "@broadside/core";
import { Color3, Matrix, Mesh, MeshBuilder, type Scene, ShaderMaterial, StandardMaterial, VertexData } from "../babylon";
import { COURSE_FRAGMENT, COURSE_VERTEX } from "../shaders/course";

type P = { readonly x: number; readonly z: number };

/**
 * A flat strip along a polyline on the sea (pure, tested): two vertices a point, offset across the
 * line by half the width (mitred at the corners by averaging the two segments' normals), riding
 * the waves at `height(x, z)`; UVs: metres along the line, 0 to 1 across. Indices for a triangle
 * strip as a list.
 */
export const ribbonOnWater = (points: readonly P[], width: number, height: (x: number, z: number) => number): { positions: number[]; uvs: number[]; indices: number[] } => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = points.length;
  if (n < 2) return { positions, uvs, indices };
  let along = 0;
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(n - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const p = points[i]!;
    if (i > 0) along += Math.hypot(p.x - points[i - 1]!.x, p.z - points[i - 1]!.z);
    for (const s of [-1, 1]) {
      const x = p.x + nx * s * width * 0.5;
      const z = p.z + nz * s * width * 0.5;
      positions.push(x, height(x, z), z);
      uvs.push(along, s < 0 ? 0 : 1);
    }
    if (i > 0) {
      const k = i * 2;
      indices.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  return { positions, uvs, indices };
};

/**
 * The no-go zone on the water (pure): a fan round the ship's position, from the wind's eye out to
 * the close-hauled limit on either side (`upwind`: the direction the wind comes from, `half`: the
 * angle off it a ship cannot sail inside), `radius` metres out; a triangle fan as a list.
 */
export const noGoFan = (at: P, upwind: number, half: number, radius: number, height: (x: number, z: number) => number, segments = 16): { positions: number[]; indices: number[] } => {
  const positions = [at.x, height(at.x, at.z), at.z];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = upwind - half + (2 * half * i) / segments;
    const x = at.x + Math.sin(a) * radius;
    const z = at.z + Math.cos(a) * radius;
    positions.push(x, height(x, z), z);
    if (i > 0) indices.push(0, i, i + 1);
  }
  return { positions, indices };
};

/** Laylines of a point to windward (pure): the two close-hauled tracks that fetch it, `length` metres back from it. */
export const laylines = (goal: P, upwind: number, half: number, length: number): P[][] =>
  [-1, 1].map((s) => {
    const h = upwind + s * half;
    return [{ x: goal.x - Math.sin(h) * length, z: goal.z - Math.cos(h) * length }, goal];
  });

/** What the wind allows, shown on the water (the app decides when). */
export interface WindView {
  readonly at: P;
  /** Where the wind comes from, and the close-hauled limit off it (radians). */
  readonly upwind: number;
  readonly half: number;
  /** A point to windward to show the laylines of (null: none). */
  readonly goal: P | null;
}

/** Colours of the marks by what they stand for (the app's CourseMark). */
const MARK_COLOURS: Record<string, Color3> = {
  go: new Color3(0.97, 0.97, 0.92),
  dock: new Color3(1.0, 0.82, 0.42),
  board: new Color3(1.0, 0.36, 0.25),
  engage: new Color3(1.0, 0.2, 0.15),
  storm: new Color3(1.0, 0.5, 0.2),
  follow: new Color3(0.45, 0.95, 0.85),
};
const colourOf = (kind: string): Color3 => MARK_COLOURS[kind] ?? MARK_COLOURS.go!;

/** Seconds a released stroke takes to sink into the sea; a ripple's life. */
const SINK = 0.8;
const RIPPLE = 1.1;

interface Ripple {
  x: number;
  z: number;
  kind: string;
  born: number;
}

/**
 * Simple steering drawn on the water. The course is light laid on the sea: a glowing thread with
 * a bright core and soft edges, pulses running along it the way the ship will go and glints like
 * sun on foam (shaders/course.ts); a line being drawn burns brighter and, let go, sinks into the
 * sea while the route the crew takes appears. A tap sends out rings on the water, and the
 * destination, or the ship or fort an order is about, has a breathing ring with an echo in the
 * order's colour (white: sail there, gold: put into port, red: board, attack or storm, sea green:
 * follow). Animated with simulation time (shots are reproducible). Unlit, riding the waves like
 * the salvo marks, widened with the isometric zoom.
 */
export class CourseView {
  private readonly stroke: Mesh;
  private readonly route: Mesh;
  private readonly strokeMat: ShaderMaterial;
  private readonly routeMat: ShaderMaterial;
  private readonly goalRing: Mesh;
  private readonly echo: Mesh;
  private readonly rings: Mesh[];
  private drawing: readonly P[] = [];
  /** The last stroke let go, sinking (and when it was let go). */
  private sinking: { points: readonly P[]; at: number } | null = null;
  private path: readonly P[] = [];
  private goal: (P & { kind?: string; size?: number }) | null = null;
  private readonly ripples: Ripple[] = [];
  private readonly fan: Mesh;
  private readonly lays: Mesh[];
  private wind: WindView | null = null;
  private time = 0;
  visible = true;

  constructor(scene: Scene) {
    const shader = (name: string): ShaderMaterial => {
      const m = new ShaderMaterial(name, scene, { vertexSource: COURSE_VERTEX, fragmentSource: COURSE_FRAGMENT }, { attributes: ["position", "uv"], uniforms: ["worldViewProjection", "time", "colour", "glow", "flow"], needAlphaBlending: true });
      m.backFaceCulling = false;
      m.disableDepthWrite = true;
      return m;
    };
    const flat = (name: string, alpha: number): StandardMaterial => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true;
      m.alpha = alpha;
      m.backFaceCulling = false;
      return m;
    };
    this.strokeMat = shader("course-stroke-mat");
    this.routeMat = shader("course-route-mat");
    this.stroke = new Mesh("course-stroke", scene);
    this.stroke.material = this.strokeMat;
    this.route = new Mesh("course-route", scene);
    this.route.material = this.routeMat;
    this.goalRing = MeshBuilder.CreateTorus("course-goal", { diameter: 8, thickness: 0.8, tessellation: 32 }, scene);
    this.goalRing.material = flat("course-goal-mat", 0.85);
    this.echo = MeshBuilder.CreateTorus("course-echo", { diameter: 8, thickness: 0.4, tessellation: 32 }, scene);
    this.echo.material = flat("course-echo-mat", 0.5);
    this.rings = [0, 1, 2].map((i) => {
      const r = MeshBuilder.CreateTorus(`course-ripple-${i}`, { diameter: 2, thickness: 0.15, tessellation: 32 }, scene);
      r.material = flat(`course-ripple-mat-${i}`, 0.7);
      return r;
    });
    // The no-go zone: a faint red fan; the laylines: thin red strips.
    const nogo = flat("course-nogo-mat", 0.16);
    nogo.emissiveColor = new Color3(0.95, 0.35, 0.25);
    this.fan = new Mesh("course-nogo", scene);
    this.fan.material = nogo;
    const lay = flat("course-layline-mat", 0.55);
    lay.emissiveColor = new Color3(1, 0.55, 0.4);
    this.lays = [0, 1].map((i) => {
      const m = new Mesh(`course-layline-${i}`, scene);
      m.material = lay;
      return m;
    });
    for (const m of [this.stroke, this.route, this.goalRing, this.echo, ...this.rings, this.fan, ...this.lays]) {
      m.isPickable = false;
      m.isVisible = false;
    }
  }

  /** The no-go zone round the ship and the laylines of a point to windward (null: hidden). */
  setWind(w: WindView | null): void {
    this.wind = w;
  }

  /** The line being drawn (world points; empty: let go, and the last one sinks). */
  setStroke(points: readonly P[]): void {
    if (points.length === 0 && this.drawing.length > 1) this.sinking = { points: this.drawing, at: this.time };
    this.drawing = points;
  }

  /** The route being sailed (from the ship on), and the ring on its goal (`kind`: what it is). */
  setRoute(points: readonly P[], goal: (P & { kind?: string; size?: number }) | null): void {
    this.path = points;
    this.goal = goal;
  }

  /** Rings spreading on the water where the player tapped, in the colour of the order given. */
  ripple(x: number, z: number, kind = "go"): void {
    this.ripples.push({ x, z, kind, born: this.time });
    if (this.ripples.length > this.rings.length) this.ripples.shift();
  }

  /** `time`: simulation seconds (animation); `view`: half-height of the frame in metres (the isometric zoom). */
  frame(waves: readonly GerstnerWave[], time: number, view = 60): void {
    this.time = time;
    const zoom = Math.max(1, view / 60);
    const h = (x: number, z: number): number => waterHeight(waves, x, z, time) + 0.9;
    const on = this.visible;
    // The stroke: bright while drawn; let go, it sinks (fades and spreads) for SINK seconds.
    const sink = this.sinking && time - this.sinking.at < SINK ? (time - this.sinking.at) / SINK : null;
    if (sink === null) this.sinking = null;
    const strokePts = this.drawing.length > 1 ? this.drawing : (this.sinking?.points ?? []);
    const fade = this.drawing.length > 1 ? 1 : sink === null ? 0 : 1 - sink;
    this.strip(this.stroke, on && fade > 0 ? strokePts : [], (2.6 + (sink ?? 0) * 3) * zoom, h);
    this.uniforms(this.strokeMat, colourOf("go"), 1.3 * fade, -1);
    this.strip(this.route, on ? this.path : [], 1.6 * zoom, h);
    this.uniforms(this.routeMat, colourOf(this.goal?.kind ?? "go"), 0.7, 1);
    this.marks(on, zoom, h);
    this.windMarks(on ? this.wind : null, zoom, h);
  }

  private windMarks(w: WindView | null, zoom: number, h: (x: number, z: number) => number): void {
    this.fan.isVisible = w !== null;
    if (w) {
      const f = noGoFan(w.at, w.upwind, w.half, 70 * zoom, h);
      const data = new VertexData();
      data.positions = f.positions;
      data.indices = f.indices;
      data.applyToMesh(this.fan, true);
    }
    const lines = w?.goal ? laylines(w.goal, w.upwind, w.half, 160 * zoom) : [];
    this.lays.forEach((m, i) => this.strip(m, lines[i] ?? [], 0.9 * zoom, h));
  }

  private uniforms(m: ShaderMaterial, c: Color3, glow: number, flow: number): void {
    m.setFloat("time", this.time);
    m.setColor3("colour", c);
    m.setFloat("glow", glow);
    m.setFloat("flow", flow);
  }

  private marks(on: boolean, zoom: number, h: (x: number, z: number) => number): void {
    const g = on ? this.goal : null;
    this.goalRing.isVisible = g !== null;
    this.echo.isVisible = g !== null;
    if (g) {
      const size = Math.max(1, g.size ?? 1) * zoom;
      const c = colourOf(g.kind ?? "go");
      // Breathing, and an echo that spreads and fades every 1.6 s (a lighthouse's slow pulse).
      const breath = 1 + 0.08 * Math.sin(this.time * 3.2);
      const e = (this.time % 1.6) / 1.6;
      this.place(this.goalRing, g.x, g.z, size * breath, h, c, 0.85);
      this.place(this.echo, g.x, g.z, size * (1 + e * 0.9), h, c, 0.55 * (1 - e));
    }
    this.rings.forEach((r, i) => {
      const rp = this.ripples[i];
      const age = rp ? (this.time - rp.born) / RIPPLE : 1;
      r.isVisible = on && rp !== undefined && age >= 0 && age < 1;
      if (r.isVisible) this.place(r, rp!.x, rp!.z, (1 + age * 9) * zoom, h, colourOf(rp!.kind), 0.8 * (1 - age) * (1 - age));
    });
  }

  private place(m: Mesh, x: number, z: number, scale: number, h: (x: number, z: number) => number, c: Color3, alpha: number): void {
    Matrix.Scaling(scale, scale, scale).multiply(Matrix.Translation(x, h(x, z), z)).decompose(m.scaling, undefined, m.position);
    const mat = m.material as StandardMaterial;
    mat.emissiveColor = c;
    mat.alpha = alpha;
  }

  private strip(mesh: Mesh, points: readonly P[], width: number, h: (x: number, z: number) => number): void {
    const r = ribbonOnWater(points, width, h);
    mesh.isVisible = r.indices.length > 0;
    if (!mesh.isVisible) return;
    const data = new VertexData();
    data.positions = r.positions;
    data.uvs = r.uvs;
    data.indices = r.indices;
    data.applyToMesh(mesh, true);
  }

  dispose(): void {
    for (const m of [this.stroke, this.route, this.goalRing, this.echo, ...this.rings, this.fan, ...this.lays]) m.dispose();
  }
}
