import { fbm2, noise1 } from "@broadside/core";
import { Color3, Mesh, type Scene, StandardMaterial, VertexData } from "../babylon";
import { SunHaze, hazeSunOf } from "./sun-haze";

/**
 * Distant coast as a backdrop: two rings of headlands far out, their skylines from fractal noise
 * and broken into separate headlands by a low-frequency mask, drawn in their own haze (setHaze).
 * They follow the camera horizontally, like a skybox layer with parallax-free depth.
 */
const SEGMENTS = 256;

export const coastHeights = (seed: number): number[] => {
  const h: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i / SEGMENTS;
    // Headlands with steep sides and flat tops (sea cliffs and mesas, as in the reference):
    // a sharp step on the mask, a gently rolling plateau, a little crag on the edges.
    const mask = noise1(seed, a * 7);
    const edge = Math.min(1, Math.max(0, (mask - 0.5) / 0.06));
    const plateau = 110 + fbm2(seed + 3, Math.cos(a * Math.PI * 2) * 3 + 9, Math.sin(a * Math.PI * 2) * 3 + 9, 3) * 120;
    const crag = fbm2(seed + 11, a * 180, 0.5, 2) * 25;
    h.push(edge * (plateau + crag * (1 - edge * 0.7)));
  }
  return h;
};

/**
 * The coast's rings: the nearer shore and a farther, taller one behind it (ref_095, ref_176: the
 * coast stands in layers, each paler in the haze than the one before it).
 */
const RINGS = [
  { radius: 2600, height: 1, salt: 0 },
  { radius: 3800, height: 1.45, salt: 17 },
] as const;
/**
 * The coast's own aerial perspective, thinner than the scene's fog (which leaves about 1% of a shore
 * at 3 km): the rock's colour goes to the fog's by 1 - exp(-d * density * HAZE_SCALE), Koschmieder's
 * law of the airlight with the extinction halved, so the shore reads as pale layers on a clear
 * or broken day and fades out under a heavy sky.
 */
export const HAZE_SCALE = 0.5;
export const coastHaze = (distance: number, fogDensity: number): number => Math.min(0.97, 1 - Math.exp(-distance * fogDensity * HAZE_SCALE));

/**
 * One ring of the coast as a mesh: the cliff's face from below the water to its top edge, then the
 * headland's top running back inland and falling away behind it, so the coast has a top and a
 * depth seen from a masthead or a high camera (a bare wall read as a pale flat band). Vertex
 * colours shade it within its haze: gullies down the face (vertical streaks of noise, as erosion
 * cuts sea cliffs), the face darker towards the water and the top edge catching the light.
 */
export const coastRing = (heights: readonly number[], radius: number, scale: number, seed: number): { positions: number[]; indices: number[]; colors: number[] } => {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  // Rows from the water up and back: distance out (times the radius), height (times the skyline's;
  // null: the foot, under the water), shade, and whether the gullies show (on the face).
  const rows = [
    [1, null, 0.78, true],
    [1.01, 1, 1.06, true],
    [1.05, 0.96, 1, false],
    [1.14, 0.35, 0.88, false],
  ] as const;
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const h = heights[i % SEGMENTS]! * scale;
    const gully = 1 - 0.18 * Math.max(0, fbm2(seed + 23, a * 90, 0.3, 2));
    for (const [out, up, shade, face] of rows) {
      positions.push(Math.sin(a) * radius * out, up === null ? -20 : h * up, Math.cos(a) * radius * out);
      const g = face ? gully : 1;
      colors.push(shade * g, shade * g, shade * g, 1);
    }
  }
  const n = rows.length;
  for (let i = 0; i < SEGMENTS; i++) {
    for (let r = 0; r < n - 1; r++) {
      const b = i * n + r;
      indices.push(b, b + 1, b + n, b + n, b + 1, b + n + 1);
    }
  }
  return { positions, indices, colors };
};

export class FarCoast {
  readonly meshes: Mesh[] = [];
  private readonly materials: StandardMaterial[] = [];
  private readonly hazes: SunHaze[] = [];

  constructor(scene: Scene, seed: number) {
    RINGS.forEach((ring, r) => {
      const { positions, indices, colors } = coastRing(coastHeights(seed + ring.salt), ring.radius, ring.height, seed + ring.salt);
      const mesh = new Mesh(`far-coast-${r}`, scene);
      const data = new VertexData();
      data.positions = positions;
      data.indices = indices;
      data.colors = colors;
      data.applyToMesh(mesh);
      // Unlit and unfogged: the colour is the haze over the rock, set each frame (setHaze).
      const m = new StandardMaterial(`far-coast-${r}`, scene);
      m.disableLighting = true;
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.backFaceCulling = false;
      mesh.material = m;
      this.hazes.push(new SunHaze(m, hazeSunOf(scene)));
      mesh.applyFog = false;
      mesh.isPickable = false;
      this.meshes.push(mesh);
      this.materials.push(m);
    });
  }

  /** The haze over each ring from the scene's fog: its colour and density (look.ts). */
  setHaze(fog: { r: number; g: number; b: number }, density: number): void {
    RINGS.forEach((ring, r) => {
      // The rock in shadow against the light: a third of the haze's brightness, then the airlight,
      // short of the fog's colour, so the shore stands a shade darker than the haze around it
      // (ref_095, ref_176; brighter, its lit top edge read as a white wall, 19.11).
      const k = 0.35 + 0.62 * coastHaze(ring.radius, density);
      this.materials[r]!.emissiveColor.set(fog.r * k, fog.g * k, fog.b * k);
      this.hazes[r]!.haze = coastHaze(ring.radius, density);
    });
  }

  follow(x: number, z: number): void {
    for (const m of this.meshes) m.position.set(x, 0, z);
  }
}
