import { type Archipelago } from "@broadside/core";
import { Color3, Matrix, Mesh, type Scene, StandardMaterial, VertexData, type ShadowGenerator } from "../babylon";
import { CHUNK, type TerrainGeometry, chunkCorners, chunkGeometry, chunkTrees, type TreeSpot } from "./island-geometry";
import { broadleafGeometry, palmGeometry, type TreeGeometry } from "./tree-geometry";
import { SunHaze, hazeSunOf } from "./sun-haze";
import { TerrainSplat } from "./terrain-splat";

/** Distance (m) from the camera to a chunk's centre within which its trees are drawn. */
const TREE_RANGE = 1100;
/** Distance (m) to a chunk's centre within which it is drawn from the dense grid (built on demand). */
const LAND_DETAIL = 1400;
/** Beyond this the dense grid and the trees of a chunk are let go (memory). */
const LAND_DROP = 2400;
/** How far beyond the sea's edge the land is drawn (m): the mainland runs on towards the horizon. */
const MARGIN = 1500;
/** Grid cells per chunk side: the far level, the near one, and the near one from the high preset up. */
const FAR_CELLS = 10;
const NEAR_CELLS = 40;
const FINE_CELLS = 64;
/** Candidate trees per chunk at budget 1 (dense jungle keeps all, beaches fewer, cliffs few). */
const TREES_PER_CHUNK = 500;
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
  mesh.freezeWorldMatrix();
  return mesh;
};

/** The instances' matrices and colours: turned, scaled to metres, set a little into the ground. */
const instanceBuffers = (spots: readonly TreeSpot[], height: number, widen: number) => {
  const matrices = new Float32Array(spots.length * 16);
  const colors = new Float32Array(spots.length * 4);
  spots.forEach((t, i) => {
    const h = height * t.scale;
    Matrix.Scaling(h * widen, h, h * widen)
      .multiply(Matrix.RotationY(t.yaw))
      .multiply(Matrix.Translation(t.x, t.y - 0.3, t.z))
      .copyToArray(matrices, i * 16);
    // Leaves from olive to deep green, a little lighter or darker per tree.
    const k = 0.8 + 0.4 * t.tint;
    colors.set([k * (1.05 - 0.15 * t.tint), k, k * 0.9, 1], i * 4);
  });
  return { matrices, colors };
};

interface ChunkView {
  readonly x: number;
  readonly z: number;
  readonly far: Mesh;
  near: Mesh | null;
  trees: Mesh[];
  /** The dense grid came out empty (all below the floor): not tried again. */
  bare: boolean;
}

/**
 * The land (the mainland, its peninsulas and the islands) in chunks of a world grid (chunked level
 * of detail, island-geometry): every chunk with land has a coarse mesh from the start; near the
 * camera a dense one is built on demand, one a frame, nearest first (the cost of sampling the
 * terrain spread over frames), and dropped again far off. Trees are thin instances of two
 * parametric models, a palm and a broadleaf tree (tree-geometry; Flyweight: the shape shared, the
 * place, turn, size and tint per instance), one pair of meshes per chunk so the frustum culls them
 * chunk by chunk, drawn within TREE_RANGE. Built from the world seed: the same land every time.
 */
export class IslandsView {
  readonly meshes: Mesh[] = [];
  private readonly chunks: ChunkView[] = [];
  private readonly ground: StandardMaterial;
  private readonly treeMat: StandardMaterial;
  private readonly models = { palm: palmGeometry(), broadleaf: broadleafGeometry() };

  // The land receives shadows but does not cast them: kilometres of casters would stretch the
  // shadow frustum over the whole sea and blur the ships' shadows.
  /** `texturesUrl`: the terrain's textures (terrain-splat; vertex colours alone without it); `fine`: a denser near grid. */
  constructor(
    private readonly scene: Scene,
    private readonly a: Archipelago,
    _shadows: ShadowGenerator | null,
    private readonly treeBudget: number,
    texturesUrl?: string,
    private readonly fine = false,
  ) {
    this.ground = new StandardMaterial("terrain", scene);
    if (texturesUrl) new TerrainSplat(this.ground, scene, texturesUrl, !fine);
    this.ground.diffuseColor = Color3.White();
    this.ground.specularColor = new Color3(0.02, 0.02, 0.02);
    this.treeMat = new StandardMaterial("tree", scene);
    this.treeMat.specularColor = Color3.Black();
    // The fronds are single sheets: both sides drawn and lit.
    this.treeMat.backFaceCulling = false;
    this.treeMat.twoSidedLighting = true;
    // Lit haze towards the sun over the land, as over the sea (sun-haze).
    for (const m of [this.ground, this.treeMat]) new SunHaze(m, hazeSunOf(scene));
    for (const c of chunkCorners(a, MARGIN)) {
      const g = chunkGeometry(a, c.x, c.z, FAR_CELLS);
      if (!g) continue;
      const far = terrainMesh(`land-${c.x}-${c.z}-far`, g, scene, this.ground);
      this.chunks.push({ x: c.x, z: c.z, far, near: null, trees: [], bare: false });
      this.meshes.push(far);
    }
  }

  /** Each frame with the camera's position: levels of detail, trees, the next dense chunk built. */
  update(x: number, z: number): void {
    let next: ChunkView | null = null;
    let nextD = Infinity;
    for (const c of this.chunks) {
      const d = Math.hypot(c.x + CHUNK / 2 - x, c.z + CHUNK / 2 - z);
      if (c.near && d > LAND_DROP) this.drop(c);
      if (!c.near && !c.bare && d < LAND_DETAIL && d < nextD) {
        next = c;
        nextD = d;
      }
      const near = !!c.near && d < LAND_DETAIL;
      c.far.setEnabled(!near);
      c.near?.setEnabled(near);
      for (const t of c.trees) t.setEnabled(d < TREE_RANGE);
    }
    if (next) this.build(next);
  }

  private build(c: ChunkView): void {
    const g = chunkGeometry(this.a, c.x, c.z, this.fine ? FINE_CELLS : NEAR_CELLS);
    if (!g) {
      c.bare = true;
      return;
    }
    c.near = terrainMesh(`land-${c.x}-${c.z}`, g, this.scene, this.ground);
    c.near.setEnabled(false);
    const spots = chunkTrees(this.a, c.x, c.z, Math.round(TREES_PER_CHUNK * this.treeBudget));
    for (const palm of [true, false]) {
      const mine = spots.filter((s) => s.palm === palm);
      if (mine.length === 0) continue;
      const host = colouredMesh(`trees-${c.x}-${c.z}-${palm ? "palm" : "broadleaf"}`, palm ? this.models.palm : this.models.broadleaf, this.scene);
      host.material = this.treeMat;
      const b = instanceBuffers(mine, palm ? PALM_HEIGHT : BROADLEAF_HEIGHT, palm ? 1 : 1.35);
      host.thinInstanceSetBuffer("matrix", b.matrices, 16, true);
      host.thinInstanceSetBuffer("color", b.colors, 4, true);
      host.thinInstanceRefreshBoundingInfo(false);
      host.setEnabled(false);
      c.trees.push(host);
    }
  }

  private drop(c: ChunkView): void {
    c.near?.dispose();
    c.near = null;
    for (const t of c.trees) t.dispose();
    c.trees = [];
  }

  /** Dense chunks built now (for tests and the frame bench). */
  get nearCount(): number {
    return this.chunks.filter((c) => c.near).length;
  }

  dispose(): void {
    for (const c of this.chunks) this.drop(c);
    for (const m of this.meshes) m.dispose();
  }
}
