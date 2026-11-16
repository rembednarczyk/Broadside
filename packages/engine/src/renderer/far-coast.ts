import { fbm2, noise1 } from "@broadside/core";
import { Color3, Mesh, type Scene, StandardMaterial, VertexData } from "../babylon";

/**
 * Distant coast as a backdrop: a ring of hills far out, its skyline from fractal noise and broken
 * into separate headlands by a low-frequency mask, drawn in the haze (fog does the aerial
 * perspective). It follows the camera horizontally, like a skybox layer with parallax-free depth.
 */
const RADIUS = 3400;
const SEGMENTS = 256;

export const coastHeights = (seed: number): number[] => {
  const h: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i / SEGMENTS;
    const mask = Math.max(0, noise1(seed, a * 6) - 0.42) / 0.58;
    const ridge = fbm2(seed + 3, Math.cos(a * Math.PI * 2) * 4 + 9, Math.sin(a * Math.PI * 2) * 4 + 9, 5);
    h.push(Math.max(0, mask * (60 + ridge * 260)));
  }
  return h;
};

export class FarCoast {
  readonly mesh: Mesh;

  constructor(scene: Scene, seed: number) {
    const heights = coastHeights(seed);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const h = heights[i % SEGMENTS]!;
      const x = Math.sin(a) * RADIUS;
      const z = Math.cos(a) * RADIUS;
      positions.push(x, -20, z, x * 1.01, h, z * 1.01);
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    this.mesh = new Mesh("far-coast", scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.normals = normals;
    data.applyToMesh(this.mesh);
    const m = new StandardMaterial("far-coast", scene);
    m.diffuseColor = new Color3(0.16, 0.15, 0.13);
    m.specularColor = new Color3(0, 0, 0);
    m.backFaceCulling = false;
    this.mesh.material = m;
    this.mesh.isPickable = false;
  }

  follow(x: number, z: number): void {
    this.mesh.position.set(x, 0, z);
  }
}
