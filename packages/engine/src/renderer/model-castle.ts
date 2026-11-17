import { Matrix, Mesh, MeshBuilder, Quaternion, type Scene, type ShadowGenerator, StandardMaterial, type Texture, type TransformNode, Vector3, VertexData } from "../babylon";
import { BALUSTRADE, type CastleLayout, WHEEL_ABAFT } from "./castle-layout";
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
    // Windows at mid-height, about every 2.4 m along the sides, clear of the corners; across the
    // transom a close row of them, the stern gallery's lights (ref_090).
    const total = dist[dist.length - 1]!;
    const count = ri === 2 ? Math.max(0, Math.floor((total - 0.5) / GALLERY_PITCH)) : Math.max(0, Math.floor((total - 1.2) / 2.4));
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
  const gallery = sternGallery(scene, parent.name, c, windows.filter((w) => w.n.z < -0.9), mats.wood);
  posts.push(...gallery.posts);
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
  const all = [walls, moulding, bar, pane, deck, rail, baluster, step, lantern, post, ...gallery.meshes, ...buildCastlePorts(scene, parent.name, c.ports, mats.wood), shipWheel(scene, parent.name, c.top, last.z - WHEEL_ABAFT, mats.wood)];
  for (const m of all) {
    m.parent = parent;
    m.isPickable = false;
  }
  for (const m of [walls, rail]) shadows?.addShadowCaster(m);
  return all;
};

/** Spacing of the gallery windows across the transom (m): a 0.78 m light and a pilaster between. */
const GALLERY_PITCH = 1.05;
/** How far the stern gallery stands out abaft the transom, and the height of its rail (m). */
const GALLERY_DEPTH = 0.75;
const GALLERY_RAIL = 0.85;

/**
 * The stern gallery: an open balcony across the transom at the level of the great cabin, its floor
 * on the castle's floor and standing out abaft it, railed with the castle's balusters (their
 * posts are returned to join the castle's own), and carved pilasters between the gallery's lights
 * with a moulding along their heads (the stern of a 17th to 18th century ship of war, as in
 * Chapman's "Architectura Navalis Mercatoria", 1768; the reference's stern, ref_090, shows its
 * close row of windows under a balustraded taffrail).
 */
const sternGallery = (scene: Scene, name: string, c: CastleLayout, lights: readonly { at: Vector3 }[], wood: StandardMaterial): { meshes: Mesh[]; posts: Matrix[] } => {
  const stern = c.ring[0]!;
  const half = stern.half * 0.94;
  const z = stern.z - GALLERY_DEPTH;
  const floor = MeshBuilder.CreateBox(`castle-gallery-${name}`, { width: half * 2, height: 0.12, depth: GALLERY_DEPTH }, scene);
  floor.position.set(0, c.base + 0.02, stern.z - GALLERY_DEPTH / 2);
  const y = c.base + GALLERY_RAIL;
  const path = [new Vector3(-half, y, stern.z), new Vector3(-half, y, z), new Vector3(half, y, z), new Vector3(half, y, stern.z)];
  const rail = MeshBuilder.CreateTube(`castle-gallery-rail-${name}`, { path, radius: 0.06, tessellation: 6, cap: Mesh.CAP_ALL }, scene);
  const posts: Matrix[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const n = Math.max(1, Math.round(Vector3.Distance(path[i]!, path[i + 1]!) / 0.32));
    for (let k = 0; k <= n; k++) {
      const p = Vector3.Lerp(path[i]!, path[i + 1]!, k / n);
      posts.push(Matrix.Compose(new Vector3(0.9, GALLERY_RAIL, 0.9), Quaternion.Identity(), new Vector3(p.x, c.base + GALLERY_RAIL / 2, p.z)));
    }
  }
  // Pilasters between the lights and at the ends of the row, and a moulding over their heads.
  const xs = lights.map((l) => l.at.x).sort((a, b) => a - b);
  const pilasters = xs.length ? [xs[0]! - GALLERY_PITCH / 2, ...xs.slice(1).map((x, i) => (x + xs[i]!) / 2), xs[xs.length - 1]! + GALLERY_PITCH / 2] : [];
  const parts = pilasters.map((x, i) => {
    const p = MeshBuilder.CreateBox(`gallery-pilaster-${name}-${i}`, { width: 0.16, height: c.top - c.base - 0.2, depth: 0.12 }, scene);
    p.position.set(x, (c.top + c.base) / 2, stern.z - 0.07);
    return p;
  });
  const head = MeshBuilder.CreateBox(`gallery-head-${name}`, { width: half * 2, height: 0.14, depth: 0.16 }, scene);
  head.position.set(0, c.base + (c.top - c.base) * 0.55 + 0.6, stern.z - 0.08);
  const carved = Mesh.MergeMeshes([floor, rail, head, ...parts], true, true)!;
  carved.name = `castle-gallery-${name}`;
  carved.material = wood;
  return { meshes: [carved], posts };
};

/**
 * The ship's wheel on the castle's deck before the helmsman: a rim on eight spokes whose handles
 * stand out past it, on an axle in a pedestal, its face towards the stern (the helm of an 18th
 * century ship; a 17th century one steered by a whipstaff below, which a deck shot cannot show).
 */
const shipWheel = (scene: Scene, name: string, deckY: number, z: number, wood: StandardMaterial): Mesh => {
  const centre = deckY + 1.05;
  const parts: Mesh[] = [];
  const rim = MeshBuilder.CreateTorus(`wheel-rim-${name}`, { diameter: 1.2, thickness: 0.07, tessellation: 24 }, scene);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, centre, z);
  parts.push(rim);
  for (let k = 0; k < 4; k++) {
    const spoke = MeshBuilder.CreateBox(`wheel-spoke-${name}-${k}`, { width: 1.5, height: 0.05, depth: 0.05 }, scene);
    spoke.rotation.z = (k * Math.PI) / 4;
    spoke.position.set(0, centre, z);
    parts.push(spoke);
  }
  const hub = MeshBuilder.CreateCylinder(`wheel-hub-${name}`, { diameter: 0.18, height: 0.5, tessellation: 10 }, scene);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, centre, z + 0.2);
  parts.push(hub);
  const pedestal = MeshBuilder.CreateBox(`wheel-pedestal-${name}`, { width: 0.32, height: centre - deckY, depth: 0.32 }, scene);
  pedestal.position.set(0, (centre + deckY) / 2, z + 0.35);
  parts.push(pedestal);
  const wheel = Mesh.MergeMeshes(parts, true, true)!;
  wheel.name = `ship-wheel-${name}`;
  wheel.material = wood;
  return wheel;
};

