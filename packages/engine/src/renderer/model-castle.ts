import { Matrix, Mesh, MeshBuilder, Quaternion, type Scene, type ShadowGenerator, StandardMaterial, type Texture, type TransformNode, Vector3, VertexData } from "../babylon";
import { BALUSTRADE, type CastleLayout } from "./castle-layout";
import { buildCastlePorts } from "./castle-ports";

/**
 * The sterncastle of a modelled hull as meshes (layout: castle-layout): walls laid strake by
 * strake in the model's own planking with mouldings at foot and head, framed windows whose glass
 * is lit at night, a planked deck, a balustrade of
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
 * Planked walls seen from both sides: the model's own planking where it was baked (`planks`),
 * else the painted castle texture. Toned to the hull beside it.
 */
const wallMaterial = (scene: Scene, castle: StandardMaterial, planks: Texture | null, key: string): StandardMaterial => {
  const name = planks ? `castle-open-${key}` : "castle-open";
  const cached = scene.getMaterialByName(name);
  if (cached) return cached as StandardMaterial;
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = planks ?? castle.diffuseTexture;
  if (planks) m.diffuseColor.set(0.95, 0.72, 0.52);
  m.specularColor = castle.specularColor.clone();
  m.backFaceCulling = false;
  m.twoSidedLighting = true;
  return m;
};

/** Window glass: dark by day, lit warm from within at night (the renderer's night glow drives it). */
const glassMaterial = (scene: Scene): StandardMaterial => {
  const cached = scene.getMaterialByName("castle-glass");
  if (cached) return cached as StandardMaterial;
  const m = new StandardMaterial("castle-glass", scene);
  m.diffuseColor.set(0.07, 0.09, 0.11);
  m.specularColor.set(0.35, 0.35, 0.35);
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

/** Windows: a frame of four bars with a cross of glazing bars, and the glass behind (lit at night). */
const buildWindows = (scene: Scene, name: string, windows: readonly { at: Vector3; n: Vector3 }[], wood: StandardMaterial): [Mesh, Mesh] => {
  const bar = MeshBuilder.CreateBox(`castle-frames-${name}`, { size: 1 }, scene);
  bar.material = wood;
  const pane = MeshBuilder.CreateBox(`castle-glass-${name}`, { size: 1 }, scene);
  pane.material = glassMaterial(scene);
  const bars: Matrix[] = [];
  const panes: Matrix[] = [];
  const W = 0.78;
  const Hh = 0.9;
  for (const w of windows) {
    const rot = Quaternion.RotationYawPitchRoll(Math.atan2(w.n.x, w.n.z), 0, 0);
    const tan = new Vector3(w.n.z, 0, -w.n.x);
    const place = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, list: Matrix[]): void => {
      list.push(Matrix.Compose(new Vector3(sx, sy, sz), rot, w.at.add(tan.scale(lx)).add(new Vector3(0, ly, 0)).add(w.n.scale(lz))));
    };
    place(0, 0, 0.03, W, Hh, 0.04, panes);
    for (const s of [-1, 1]) {
      place((s * W) / 2, 0, 0.07, 0.09, Hh + 0.09, 0.12, bars);
      place(0, (s * Hh) / 2, 0.07, W + 0.09, 0.09, 0.12, bars);
    }
    place(0, 0, 0.07, 0.045, Hh, 0.08, bars);
    place(0, 0, 0.07, W, 0.045, 0.08, bars);
  }
  instances(bar, bars);
  instances(pane, panes);
  return [bar, pane];
};

export const buildModelCastle = (scene: Scene, parent: TransformNode, c: CastleLayout, mats: CastleMaterials, shadows: ShadowGenerator | null, planks: { texture: Texture; w: number; h: number } | null = null, key = ""): Mesh[] => {
  const ring = c.ring;
  const last = ring[ring.length - 1]!;
  const stern = ring[0]!;
  // Walls, built as a shipwright planks them: strakes about 0.3 m deep laid one above another,
  // each standing a little proud at its lower edge (the lap casts a line of shadow, as on the hull),
  // and each taking its own stretch of the model's planking, so no two strakes repeat.
  const strakes = Math.max(4, Math.round((c.top - c.base) / 0.3));
  const depth = (c.top - c.base) / strakes;
  const pw = planks?.w ?? 5;
  const ph = planks?.h ?? c.top - c.base;
  const frac = (v: number): number => v - Math.floor(v);
  const hash = (j: number, salt: number): number => frac(Math.sin(j * 12.9898 + salt * 78.233) * 43758.5453);
  type Run = { pts: Vector3[]; normal: (i: number) => Vector3 };
  const sideRun = (s: number): Run => {
    const pts = ring.map((r) => new Vector3(s * r.half, 0, r.z));
    return { pts, normal: (i) => {
      const d = pts[Math.min(pts.length - 1, i + 1)]!.subtract(pts[Math.max(0, i - 1)]!).normalize();
      return new Vector3(s * Math.abs(d.z), 0, -s * Math.sign(d.z) * d.x).normalize();
    } };
  };
  const runs: Run[] = [
    sideRun(1),
    sideRun(-1),
    { pts: [new Vector3(-stern.half, 0, stern.z), new Vector3(stern.half, 0, stern.z)], normal: () => new Vector3(0, 0, -1) },
    { pts: [new Vector3(-last.half, 0, last.z), new Vector3(last.half, 0, last.z)], normal: () => new Vector3(0, 0, 1) },
  ];
  const wp: number[] = [];
  const wu: number[] = [];
  const wi: number[] = [];
  const mouldings: Vector3[][] = [];
  const windows: { at: Vector3; n: Vector3 }[] = [];
  runs.forEach((run, ri) => {
    const dist = [0];
    for (let i = 1; i < run.pts.length; i++) dist.push(dist[i - 1]! + Vector3.Distance(run.pts[i - 1]!, run.pts[i]!));
    for (let j = 0; j < strakes; j++) {
      const y0 = c.base + j * depth;
      const u0 = hash(j, ri + 1);
      const v0 = hash(j, ri + 11) * 0.7;
      for (let i = 0; i < run.pts.length - 1; i++) {
        const n = wp.length / 3;
        for (const k of [i, i + 1]) {
          const out = run.normal(k);
          const p = run.pts[k]!;
          wp.push(p.x + out.x * 0.035, y0, p.z + out.z * 0.035, p.x, y0 + depth, p.z);
          wu.push(u0 + dist[k]! / pw, v0, u0 + dist[k]! / pw, v0 + depth / ph);
        }
        wi.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    // Mouldings along the foot and the head of the wall, like the wales of the hull.
    for (const y of [c.base + 0.03, c.top - 0.06]) mouldings.push(run.pts.map((p, i) => p.add(run.normal(i).scale(0.05)).add(new Vector3(0, y, 0))));
    // Windows at mid-height, about every 2.4 m, clear of the corners.
    const total = dist[dist.length - 1]!;
    const count = Math.max(0, Math.floor((total - 1.2) / 2.4));
    for (let w = 0; w < count; w++) {
      const d = (total * (w + 0.5)) / count;
      const i = Math.max(0, dist.findIndex((x) => x >= d) - 1);
      const t = (d - dist[i]!) / Math.max(1e-6, dist[i + 1]! - dist[i]!);
      const at = Vector3.Lerp(run.pts[i]!, run.pts[i + 1]!, t).add(new Vector3(0, c.base + (c.top - c.base) * 0.55, 0));
      // No window where a gun port is cut.
      if (!c.ports.some((port) => Math.hypot(port.at[0] - at.x, port.at[2] - at.z) < 1.1)) windows.push({ at, n: run.normal(i) });
    }
  });
  const walls = meshOf(scene, `castle-${parent.name}`, wp, wu, wi);
  walls.material = wallMaterial(scene, mats.castle, planks?.texture ?? null, key);
  const trims = mouldings.map((path, i) => MeshBuilder.CreateTube(`castle-moulding-${i}`, { path, radius: 0.075, tessellation: 6, cap: Mesh.CAP_ALL }, scene));
  const moulding = Mesh.MergeMeshes(trims, true, true)!;
  moulding.name = `castle-mouldings-${parent.name}`;
  moulding.material = mats.wood;
  const [bar, pane] = buildWindows(scene, parent.name, windows, mats.wood);
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
  const all = [walls, moulding, bar, pane, deck, rail, baluster, step, lantern, post, ...buildCastlePorts(scene, parent.name, c.ports, mats.wood)];
  for (const m of all) {
    m.parent = parent;
    m.isPickable = false;
  }
  for (const m of [walls, rail]) shadows?.addShadowCaster(m);
  return all;
};
