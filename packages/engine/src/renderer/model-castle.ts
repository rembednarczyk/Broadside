import { Matrix, Mesh, MeshBuilder, Quaternion, type Scene, type ShadowGenerator, StandardMaterial, type Texture, type TransformNode, Vector3, VertexData } from "../babylon";
import { BALUSTRADE, type CastleLayout } from "./castle-layout";

/**
 * The sterncastle of a modelled hull as meshes (layout: castle-layout): planked walls with the
 * gallery windows of the castle texture (they glow at night), a planked deck, a balustrade of
 * turned balusters all round (thin instances: Flyweight), two stairs down to the waist and the
 * stern lanterns. Static; built once per ship.
 */
export interface CastleMaterials {
  readonly castle: StandardMaterial;
  readonly deck: StandardMaterial;
  readonly wood: StandardMaterial;
  readonly lantern: StandardMaterial;
}

/**
 * Walls seen from both sides: the model's own planking where it was baked (`planks`), else the
 * painted castle texture; the gallery windows glow through either (same glow map, so the night
 * lighting follows).
 */
const wallMaterial = (scene: Scene, castle: StandardMaterial, planks: Texture | null, key: string): StandardMaterial => {
  const name = planks ? `castle-open-${key}` : "castle-open";
  const cached = scene.getMaterialByName(name);
  if (cached) return cached as StandardMaterial;
  // A new material on the same textures (cloning would copy the painted textures as blanks).
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = planks ?? castle.diffuseTexture;
  // In the shade of the sails the wall takes the sky's blue: warm it towards the hull's own tone.
  if (planks) m.diffuseColor.set(1, 0.86, 0.72);
  m.emissiveTexture = castle.emissiveTexture;
  m.emissiveColor = castle.emissiveColor.clone();
  m.specularColor = castle.specularColor.clone();
  m.backFaceCulling = false;
  m.twoSidedLighting = true;
  return m;
};

const meshOf = (scene: Scene, name: string, positions: number[], uvs: number[], indices: number[]): Mesh => {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.positions = positions;
  data.normals = normals;
  data.uvs = uvs;
  data.indices = indices;
  data.applyToMesh(mesh);
  return mesh;
};

const instances = (mesh: Mesh, list: Matrix[]): void => {
  const buf = new Float32Array(list.length * 16);
  list.forEach((m, i) => m.copyToArray(buf, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
  mesh.alwaysSelectAsActiveMesh = true;
};

export const buildModelCastle = (scene: Scene, parent: TransformNode, c: CastleLayout, mats: CastleMaterials, shadows: ShadowGenerator | null, planks: Texture | null = null, key = ""): Mesh[] => {
  const ring = c.ring;
  const last = ring[ring.length - 1]!;
  const stern = ring[0]!;
  // Walls: both sides along the ring, the transom and the bulkhead at the break. One window bay of
  // the texture to about five metres of wall.
  const wp: number[] = [];
  const wu: number[] = [];
  const wi: number[] = [];
  const quad = (a: readonly [number, number, number], b: readonly [number, number, number], u0: number, u1: number): void => {
    const n = wp.length / 3;
    wp.push(a[0], c.base, a[2], a[0], c.top, a[2], b[0], c.base, b[2], b[0], c.top, b[2]);
    wu.push(u0, 0, u0, 1, u1, 0, u1, 1);
    wi.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  };
  for (const s of [1, -1]) {
    for (let i = 0; i < ring.length - 1; i++) quad([s * ring[i]!.half, 0, ring[i]!.z], [s * ring[i + 1]!.half, 0, ring[i + 1]!.z], (ring[i]!.z - stern.z) / 5, (ring[i + 1]!.z - stern.z) / 5);
  }
  quad([-stern.half, 0, stern.z], [stern.half, 0, stern.z], 0, (stern.half * 2) / 5);
  quad([-last.half, 0, last.z], [last.half, 0, last.z], 0, (last.half * 2) / 5);
  const walls = meshOf(scene, `castle-${parent.name}`, wp, wu, wi);
  walls.material = wallMaterial(scene, mats.castle, planks, key);
  // Deck: a strip from side to side, planks fore and aft.
  const dp: number[] = [];
  const du: number[] = [];
  const di: number[] = [];
  ring.forEach((r, i) => {
    dp.push(-r.half, c.top, r.z, r.half, c.top, r.z);
    du.push(0, r.z / 4, 1, r.z / 4);
    if (i > 0) di.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
  });
  const deck = meshOf(scene, `castle-deck-${parent.name}`, dp, du, di);
  deck.material = mats.deck;
  deck.receiveShadows = true;
  // Balustrade round the deck: a rail on balusters every 0.45 m, open at the two stairs.
  const stairX = last.half * 0.55;
  const edge: Vector3[] = [new Vector3(-stairX + 0.6, 0, last.z), new Vector3(-last.half, 0, last.z), ...[...ring].reverse().map((r) => new Vector3(-r.half, 0, r.z)), ...ring.map((r) => new Vector3(r.half, 0, r.z)), new Vector3(stairX - 0.6, 0, last.z)];
  const rail = MeshBuilder.CreateTube(`castle-rail-${parent.name}`, { path: edge.map((p) => new Vector3(p.x, c.top + BALUSTRADE, p.z)), radius: 0.07, tessellation: 6, cap: Mesh.CAP_ALL }, scene);
  rail.material = mats.wood;
  const baluster = MeshBuilder.CreateLathe(`castle-balusters-${parent.name}`, { shape: [[0.05, 0], [0.05, 0.12], [0.085, 0.3], [0.04, 0.55], [0.07, 0.8], [0.05, 1]].map(([r, y]) => new Vector3(r!, y! - 0.5, 0)), tessellation: 6 }, scene);
  baluster.material = mats.wood;
  const posts: Matrix[] = [];
  for (let i = 0; i < edge.length - 1; i++) {
    const n = Math.max(1, Math.round(Vector3.Distance(edge[i]!, edge[i + 1]!) / 0.45));
    for (let k = 0; k < n; k++) {
      const p = Vector3.Lerp(edge[i]!, edge[i + 1]!, k / n);
      posts.push(Matrix.Compose(new Vector3(1, BALUSTRADE, 1), Quaternion.Identity(), new Vector3(p.x, c.top + BALUSTRADE / 2, p.z)));
    }
  }
  instances(baluster, posts);
  // Stairs from the waist up to the castle's deck, one a side.
  const rise = Math.max(0.5, c.top - c.waist);
  const steps = Math.ceil(rise / 0.24);
  const step = MeshBuilder.CreateBox(`castle-stairs-${parent.name}`, { width: 1.1, height: 0.06, depth: 0.3 }, scene);
  step.material = mats.wood;
  const treads: Matrix[] = [];
  for (const s of [1, -1]) for (let k = 0; k < steps; k++) treads.push(Matrix.Translation(s * stairX, c.top - (k + 0.5) * (rise / steps), last.z + 0.2 + k * 0.27));
  instances(step, treads);
  // Stern lanterns: a glazed box on an iron post.
  const lantern = MeshBuilder.CreateCylinder(`castle-lanterns-${parent.name}`, { height: 0.55, diameterTop: 0.42, diameterBottom: 0.3, tessellation: 6 }, scene);
  lantern.material = mats.lantern;
  instances(lantern, c.lanterns.map((l) => Matrix.Translation(l[0], l[1], l[2])));
  const post = MeshBuilder.CreateCylinder(`castle-lantern-posts-${parent.name}`, { height: 1, diameter: 0.06, tessellation: 5 }, scene);
  post.material = mats.wood;
  instances(post, c.lanterns.map((l) => Matrix.Compose(new Vector3(1, l[1] - 0.27 - (c.top + BALUSTRADE), 1), Quaternion.Identity(), new Vector3(l[0], (l[1] - 0.27 + c.top + BALUSTRADE) / 2, l[2]))));
  const all = [walls, deck, rail, baluster, step, lantern, post];
  for (const m of all) {
    m.parent = parent;
    m.isPickable = false;
  }
  for (const m of [walls, rail]) shadows?.addShadowCaster(m);
  return all;
};
