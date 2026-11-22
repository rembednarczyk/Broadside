import { type FortClassDef, FOUNDATION, fortLayout, wallNormal, type WallSegment } from "@broadside/core";
import { Mesh, MeshBuilder, type Scene, Vector4 } from "../babylon";
import { type PartState } from "./fort-damage";

/**
 * A fort's stone as one mesh, built from the class layout (core fort-layout) and the state of each
 * part (fort-damage): walls with a parapet along their outer edge broken by an embrasure at each
 * gun (the Vauban rampart: a terreplein for the guns behind a parapet pierced for them), towers
 * with merlons, breaches torn in the walls' tops and towers cut down, cones of rubble at their
 * feet. Texture coordinates in metres (one repeat of the ashlar texture is 9.6 m: blocks of
 * 1.2 × 0.6 m, big enough not to shimmer at a few hundred metres) on every face, so the courses keep their size whatever the length of the wall
 * (beta test 22.11: the texture stretched per face). Rebuilt when a part changes state (rare).
 */
export const ASHLAR_REPEAT = 9.6;

const PARAPET_HEIGHT = 1.3;
const PARAPET_THICKNESS = 1.0;
/** Half the width of an embrasure (m). */
const EMBRASURE = 0.8;
/** The breach: the middle of the wall from 38% to 62% of its length, cut down to 35% of its height. */
const BREACH = [0.38, 0.62] as const;
const BREACH_HEIGHT = 0.35;

/** UVs of a box (width x, height y, depth z) in metres: the long sides get length × height. */
const boxUV = (width: number, height: number, depth: number): Vector4[] => {
  const r = ASHLAR_REPEAT;
  const zFace = new Vector4(0, 0, width / r, height / r);
  const xFace = new Vector4(0, 0, depth / r, height / r);
  const yFace = new Vector4(0, 0, width / r, depth / r);
  return [zFace, zFace, xFace, xFace, yFace, yFace];
};

/** A block along a wall's line from t0 to t1 (shares of its length), its foot at `y0`, `height` tall, `across` offset outwards. */
const block = (scene: Scene, w: WallSegment, t0: number, t1: number, y0: number, height: number, thickness: number, across: number): Mesh => {
  const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const depth = Math.max(0.2, (t1 - t0) * len);
  const b = MeshBuilder.CreateBox("fort-block", { width: thickness, height, depth, faceUV: boxUV(thickness, height, depth), wrap: true }, scene);
  const t = (t0 + t1) / 2;
  const n = wallNormal(w);
  b.position.set(w.x0 + (w.x1 - w.x0) * t + Math.sin(n) * across, y0 + height / 2, w.z0 + (w.z1 - w.z0) * t + Math.cos(n) * across);
  b.rotation.y = Math.atan2(w.x1 - w.x0, w.z1 - w.z0);
  return b;
};

/** Spans of 0..1 left after cutting out the given intervals (sorted, clipped). */
export const spansWithout = (cuts: readonly (readonly [number, number])[]): [number, number][] => {
  const sorted = [...cuts].map(([a, b]) => [Math.max(0, a), Math.min(1, b)] as [number, number]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = 0;
  for (const [a, b] of sorted) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < 1) out.push([at, 1]);
  return out;
};

/** A heap of fallen stone: a few flattened, overlapping lumps (low-poly spheres), not a smooth cone. */
const rubble = (scene: Scene, x: number, z: number, size: number, height: number): Mesh => {
  const lumps: Mesh[] = [];
  const offsets = [[0, 0, 1], [0.32, 0.18, 0.7], [-0.3, 0.22, 0.65], [0.1, -0.33, 0.6], [-0.18, -0.25, 0.5]] as const;
  for (const [ox, oz, k] of offsets) {
    const s = MeshBuilder.CreateSphere("fort-rubble", { diameter: size * k, segments: 3 }, scene);
    s.scaling.set(1.2, (height / (size * k)) * 1.6, 0.9);
    s.position.set(x + ox * size, -0.3, z + oz * size);
    lumps.push(s);
  }
  return Mesh.MergeMeshes(lumps, true)!;
};

const wallParts = (scene: Scene, def: FortClassDef, w: WallSegment, index: number, state: PartState, parts: Mesh[]): void => {
  const l = fortLayout(def);
  const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const extend = (w.thickness * 0.25) / Math.max(1, len);
  const full = w.height + FOUNDATION;
  const breach = state === 2 ? [BREACH] : [];
  for (const [a, b] of spansWithout(breach)) parts.push(block(scene, w, a - (a === 0 ? extend : 0), b + (b === 1 ? extend : 0), -FOUNDATION, full, w.thickness, 0));
  if (state === 2) {
    parts.push(block(scene, w, BREACH[0], BREACH[1], -FOUNDATION, FOUNDATION + w.height * BREACH_HEIGHT, w.thickness, 0));
    const n = wallNormal(w);
    const mx = (w.x0 + w.x1) / 2 + Math.sin(n) * (w.thickness / 2 + 2.5);
    const mz = (w.z0 + w.z1) / 2 + Math.cos(n) * (w.thickness / 2 + 2.5);
    parts.push(rubble(scene, mx, mz, Math.min(9, len * 0.3), w.height * 0.4));
  }
  // The parapet along the outer edge, broken by the embrasures and the breach.
  const embrasures = l.guns.filter((g) => !g.tower && g.on === index).map((g) => {
    const t = Math.hypot(g.x - w.x0, g.z - w.z0) / Math.max(1, len);
    return [t - EMBRASURE / len, t + EMBRASURE / len] as const;
  });
  for (const [a, b] of spansWithout([...embrasures, ...breach])) parts.push(block(scene, w, a, b, w.height, PARAPET_HEIGHT, PARAPET_THICKNESS, w.thickness / 2 - PARAPET_THICKNESS / 2));
};

const towerParts = (scene: Scene, t: { x: number; z: number; radius: number; height: number }, state: PartState, parts: Mesh[]): void => {
  const height = state === 2 ? t.height * 0.65 : t.height;
  const full = height + FOUNDATION;
  const round = Math.PI * 2 * t.radius;
  const c = MeshBuilder.CreateCylinder("fort-tower", { height: full, diameter: t.radius * 2, tessellation: 16, faceUV: [new Vector4(0, 0, (t.radius * 2) / ASHLAR_REPEAT, (t.radius * 2) / ASHLAR_REPEAT), new Vector4(0, 0, round / ASHLAR_REPEAT, full / ASHLAR_REPEAT), new Vector4(0, 0, (t.radius * 2) / ASHLAR_REPEAT, (t.radius * 2) / ASHLAR_REPEAT)] }, scene);
  c.position.set(t.x, (height - FOUNDATION) / 2, t.z);
  parts.push(c);
  if (state === 2) {
    // The heap falls outwards (a central donjon's towards the sea, the fort's +z).
    const d = Math.hypot(t.x, t.z);
    const ox = d > 1 ? t.x / d : 0;
    const oz = d > 1 ? t.z / d : 1;
    parts.push(rubble(scene, t.x + ox * (t.radius + 2), t.z + oz * (t.radius + 2), Math.min(10, t.radius * 1.2), t.height * 0.25));
    return;
  }
  const merlons = Math.max(8, Math.round(round / 2.4));
  for (let i = 0; i < merlons; i++) {
    const a = (i / merlons) * Math.PI * 2;
    const m = MeshBuilder.CreateBox("merlon", { width: 1.2, height: 1.4, depth: 1.0, faceUV: boxUV(1.2, 1.4, 1.0) }, scene);
    m.position.set(t.x + Math.sin(a) * (t.radius - 0.5), height + 0.7, t.z + Math.cos(a) * (t.radius - 0.5));
    m.rotation.y = a;
    parts.push(m);
  }
};

/** The fort's stone in fort space (parent it to the fort's root). */
export const buildFortStone = (scene: Scene, def: FortClassDef, states: readonly PartState[]): Mesh => {
  const l = fortLayout(def);
  const parts: Mesh[] = [];
  l.walls.forEach((w, i) => wallParts(scene, def, w, i, states[i] ?? 0, parts));
  l.towers.forEach((t, i) => towerParts(scene, t, states[l.walls.length + i] ?? 0, parts));
  return Mesh.MergeMeshes(parts, true, true)!;
};

/** Height of the flag's tower now (a breached tower is cut down). */
export const towerTop = (def: FortClassDef, states: readonly PartState[]): { x: number; z: number; height: number } => {
  const l = fortLayout(def);
  let best = { x: 0, z: 0, height: def.height };
  l.towers.forEach((t, i) => {
    const h = (states[l.walls.length + i] ?? 0) === 2 ? t.height * 0.65 : t.height;
    if (h > best.height) best = { x: t.x, z: t.z, height: h };
  });
  return best;
};
