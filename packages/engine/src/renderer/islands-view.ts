import { type Archipelago } from "@broadside/core";
import { Color3, Matrix, Mesh, MeshBuilder, type Scene, StandardMaterial, VertexData, type ShadowGenerator } from "../babylon";
import { islandGeometry, treeSpots } from "./island-geometry";
import { SunHaze, hazeSunOf } from "./sun-haze";

/**
 * The islands of the archipelago: one terrain mesh each (vertex colours), trees as thin
 * instances of a trunk and a crown (Flyweight). Built once from the world seed.
 */
export class IslandsView {
  readonly meshes: Mesh[] = [];

  // Islands receive shadows but do not cast them: kilometres of casters would stretch the shadow
  // frustum over the whole sea and blur the ships' shadows.
  constructor(scene: Scene, a: Archipelago, _shadows: ShadowGenerator | null, treeBudget: number) {
    const ground = new StandardMaterial("terrain", scene);
    ground.diffuseColor = Color3.White();
    ground.specularColor = new Color3(0.02, 0.02, 0.02);
    const trunkMat = new StandardMaterial("trunk", scene);
    trunkMat.diffuseColor = new Color3(0.25, 0.18, 0.12);
    const crownMat = new StandardMaterial("crown", scene);
    crownMat.diffuseColor = new Color3(0.12, 0.18, 0.09);
    crownMat.specularColor = Color3.Black();
    // Lit haze towards the sun over the land, as over the sea (sun-haze).
    for (const m of [ground, trunkMat, crownMat]) new SunHaze(m, hazeSunOf(scene));
    const trunk = MeshBuilder.CreateCylinder("tree-trunk", { height: 1, diameterTop: 0.25, diameterBottom: 0.45, tessellation: 5 }, scene);
    trunk.material = trunkMat;
    const crown = MeshBuilder.CreateSphere("tree-crown", { diameter: 1, segments: 4 }, scene);
    crown.material = crownMat;
    const trunks: number[] = [];
    const terrain: Mesh[] = [];
    const crowns: number[] = [];
    for (const is of a.islands) {
      const g = islandGeometry(is);
      const mesh = new Mesh(`island-${is.id}`, scene);
      const data = new VertexData();
      data.positions = g.positions;
      data.indices = g.indices;
      data.colors = g.colors;
      const normals: number[] = [];
      VertexData.ComputeNormals(g.positions, g.indices, normals);
      data.normals = normals;
      data.applyToMesh(mesh);
      mesh.position.set(is.x, 0, is.z);
      terrain.push(mesh);
      for (const t of treeSpots(is, Math.round((is.kind === "jungle" ? 160 : 60) * treeBudget))) {
        const h = 9 * t.scale;
        trunks.push(...Matrix.Scaling(t.scale, h, t.scale).multiply(Matrix.Translation(is.x + t.x, t.y + h / 2, is.z + t.z)).m);
        crowns.push(...Matrix.Scaling(6 * t.scale, 4.5 * t.scale, 6 * t.scale).multiply(Matrix.Translation(is.x + t.x, t.y + h, is.z + t.z)).m);
      }
    }
    // One draw call for all the land (Batching): positions are baked in by the merge.
    const land = Mesh.MergeMeshes(terrain, true, true);
    if (land) {
      land.name = "islands";
      land.material = ground;
      land.receiveShadows = true;
      land.freezeWorldMatrix();
      this.meshes.push(land);
    }
    trunk.thinInstanceSetBuffer("matrix", new Float32Array(trunks), 16, true);
    crown.thinInstanceSetBuffer("matrix", new Float32Array(crowns), 16, true);
    this.meshes.push(trunk, crown);
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
  }
}
