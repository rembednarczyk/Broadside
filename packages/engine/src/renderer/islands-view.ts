import { type Archipelago } from "@broadside/core";
import { Color3, Matrix, Mesh, type Scene, StandardMaterial, VertexData, type ShadowGenerator } from "../babylon";
import { type TerrainGeometry, islandGeometry, treeSpots, type TreeSpot } from "./island-geometry";
import { broadleafGeometry, palmGeometry, type TreeGeometry } from "./tree-geometry";
import { SunHaze, hazeSunOf } from "./sun-haze";
import { TerrainSplat } from "./terrain-splat";

/** Distance (m) from the camera to an island's trees beyond which they are not drawn. */
const TREE_RANGE = 1800;
/** Distance (m) to an island's centre beyond which its terrain is drawn from the coarse grid. */
const LAND_DETAIL = 1400;
/** Height (m) of a tree of scale 1: palms to the crown, broadleaf trees to the top of the canopy. */
const PALM_HEIGHT = 13;
const BROADLEAF_HEIGHT = 13;

/** A mesh from positions, indices and vertex colours, with smooth normals. */
const colouredMesh = (name: string, g: TerrainGeometry | TreeGeometry, scene: Scene): Mesh => {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = g.positions;
  data.indices = g.indices;
  data.colors = g.colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(g.positions, g.indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  mesh.isPickable = false;
  return mesh;
};

/** One island's terrain from its grid (positions relative to its centre), receiving shadows. */
const terrainMesh = (name: string, g: TerrainGeometry, scene: Scene, material: StandardMaterial): Mesh => {
  const mesh = colouredMesh(name, g, scene);
  mesh.material = material;
  mesh.receiveShadows = true;
  return mesh;
};

/** The instances' matrices and colours: turned, scaled to metres, set a little into the ground. */
const instanceBuffers = (spots: readonly TreeSpot[], ox: number, oz: number, height: number, widen: number) => {
  const matrices = new Float32Array(spots.length * 16);
  const colors = new Float32Array(spots.length * 4);
  spots.forEach((t, i) => {
    const h = height * t.scale;
    Matrix.Scaling(h * widen, h, h * widen)
      .multiply(Matrix.RotationY(t.yaw))
      .multiply(Matrix.Translation(ox + t.x, t.y - 0.3, oz + t.z))
      .copyToArray(matrices, i * 16);
    // Leaves from olive to deep green, a little lighter or darker per tree.
    const k = 0.8 + 0.4 * t.tint;
    colors.set([k * (1.05 - 0.15 * t.tint), k, k * 0.9, 1], i * 4);
  });
  return { matrices, colors };
};

/**
 * The islands of the archipelago: one terrain mesh each (vertex colours, two levels of detail), trees as thin
 * instances of two parametric models, a palm and a broadleaf tree (tree-geometry; Flyweight: the
 * shape shared, the place, turn, size and tint per instance). The trees of each island are their
 * own pair of meshes, so the camera's frustum culls them island by island, and a level of detail
 * with no mesh drops them beyond TREE_RANGE, where the haze has taken them. Built once from the
 * world seed.
 */
export class IslandsView {
  readonly meshes: Mesh[] = [];

  // Islands receive shadows but do not cast them: kilometres of casters would stretch the shadow
  // frustum over the whole sea and blur the ships' shadows.
  /** `texturesUrl`: the terrain's textures (terrain-splat; vertex colours alone without it); `fine`: a denser grid. */
  constructor(scene: Scene, a: Archipelago, _shadows: ShadowGenerator | null, treeBudget: number, texturesUrl?: string, fine = false) {
    const ground = new StandardMaterial("terrain", scene);
    if (texturesUrl) new TerrainSplat(ground, scene, texturesUrl, !fine);
    ground.diffuseColor = Color3.White();
    ground.specularColor = new Color3(0.02, 0.02, 0.02);
    const treeMat = new StandardMaterial("tree", scene);
    treeMat.specularColor = Color3.Black();
    // The fronds are single sheets: both sides drawn and lit.
    treeMat.backFaceCulling = false;
    treeMat.twoSidedLighting = true;
    // Lit haze towards the sun over the land, as over the sea (sun-haze).
    for (const m of [ground, treeMat]) new SunHaze(m, hazeSunOf(scene));
    // Each island's trees get their own copy of the model's vertices (a few hundred): thin instances
    // keep their buffers on the geometry, so meshes sharing one would draw only the last island's.
    const models = { palm: palmGeometry(), broadleaf: broadleafGeometry() };
    for (const is of a.islands) {
      // Each island its own mesh (the camera's frustum culls those out of view; merged into one,
      // the whole archipelago's grid was drawn every frame, 1.6 million triangles on high), with a
      // coarse grid beyond LAND_DETAIL (Level of Detail): far off the haze blurs the coast anyway.
      const mesh = terrainMesh(`island-${is.id}`, fine ? islandGeometry(is, 72, 192) : islandGeometry(is), scene, ground);
      const far = terrainMesh(`island-${is.id}-far`, islandGeometry(is, 16, 40), scene, ground);
      for (const m of [mesh, far]) m.position.set(is.x, 0, is.z);
      mesh.addLODLevel(LAND_DETAIL, far);
      for (const m of [mesh, far]) m.freezeWorldMatrix();
      this.meshes.push(mesh, far);
      const spots = treeSpots(is, Math.round((is.kind === "jungle" ? 600 : 110) * treeBudget));
      for (const palm of [true, false]) {
        const mine = spots.filter((s) => s.palm === palm);
        if (mine.length === 0) continue;
        const host = colouredMesh(`trees-${is.id}-${palm ? "palm" : "broadleaf"}`, palm ? models.palm : models.broadleaf, scene);
        host.material = treeMat;
        const b = instanceBuffers(mine, is.x, is.z, palm ? PALM_HEIGHT : BROADLEAF_HEIGHT, palm ? 1 : 1.35);
        host.thinInstanceSetBuffer("matrix", b.matrices, 16, true);
        host.thinInstanceSetBuffer("color", b.colors, 4, true);
        host.thinInstanceRefreshBoundingInfo(false);
        host.addLODLevel(TREE_RANGE, null);
        this.meshes.push(host);
      }
    }
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
  }
}
