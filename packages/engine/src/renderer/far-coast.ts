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

export class FarCoast {
  readonly meshes: Mesh[] = [];
  private readonly materials: StandardMaterial[] = [];
  private readonly hazes: SunHaze[] = [];

  constructor(scene: Scene, seed: number) {
    RINGS.forEach((ring, r) => {
      const heights = coastHeights(seed + ring.salt);
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        const h = heights[i % SEGMENTS]! * ring.height;
        const x = Math.sin(a) * ring.radius;
        const z = Math.cos(a) * ring.radius;
        positions.push(x, -20, z, x * 1.01, h, z * 1.01);
      }
      for (let i = 0; i < SEGMENTS; i++) {
        const b = i * 2;
        indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
      }
      const mesh = new Mesh(`far-coast-${r}`, scene);
      const data = new VertexData();
      data.positions = positions;
      data.indices = indices;
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
      // which at the horizon is brighter than the scene's fog colour (the sky's glowing band of haze).
      const k = 0.35 + 0.8 * coastHaze(ring.radius, density);
      this.materials[r]!.emissiveColor.set(fog.r * k, fog.g * k, fog.b * k);
      this.hazes[r]!.haze = coastHaze(ring.radius, density);
    });
  }

  follow(x: number, z: number): void {
    for (const m of this.meshes) m.position.set(x, 0, z);
  }
}
