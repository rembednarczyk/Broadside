import { type Faction, type FortClassDef, fortFacing, fortLayout, fortToWorld, type FortSite, wallNormal } from "@broadside/core";
import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, type Scene, StandardMaterial, Vector3 } from "../babylon";

/**
 * The fittings of a fort beyond its stone: the harbour chain on its log floats between two posts
 * (shown while it is up; lowered or parted it lies on the bottom), the shot furnace in the court
 * (a brick oven with a chimney, its smoke from the effects), and the garrison on the walls as
 * small figures behind the parapets (thin instances of one mesh, coloured per instance by the
 * owner's coat: Flyweight), fewer as the garrison falls. At a fort's distance a figure is a few
 * pixels, so a capsule and a head do (the ships' animated crew would cost far more).
 */
const COATS: Readonly<Record<Faction, readonly [number, number, number]>> = {
  player: [0.55, 0.16, 0.12],
  crown: [0.62, 0.12, 0.1],
  republic: [0.14, 0.2, 0.45],
  empire: [0.75, 0.72, 0.62],
  pirates: [0.25, 0.22, 0.18],
};

/** Men per figure on the walls, and the most figures a fort shows. */
const MEN_PER_FIGURE = 8;
const MAX_FIGURES = 40;

/** Where a fort's figures stand (fort space): behind the parapet of each wall, round the top of a lone tower. */
export const garrisonPosts = (def: FortClassDef, count: number): { x: number; y: number; z: number; yaw: number }[] => {
  const l = fortLayout(def);
  const out: { x: number; y: number; z: number; yaw: number }[] = [];
  if (l.walls.length === 0) {
    const t = l.towers[0];
    if (!t) return out;
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2 + 0.3;
      out.push({ x: t.x + Math.sin(a) * (t.radius - 1.5), y: t.height, z: t.z + Math.cos(a) * (t.radius - 1.5), yaw: a });
    }
    return out;
  }
  for (let i = 0; i < count; i++) {
    const w = l.walls[i % l.walls.length]!;
    const row = Math.floor(i / l.walls.length);
    // Between the guns: a fifth of the way, then two fifths, ... along the wall, staggered by row.
    const t = 0.15 + ((row * 0.37 + (i % 3) * 0.23) % 0.7);
    const n = wallNormal(w);
    const back = w.thickness / 2 - 1.8;
    out.push({ x: w.x0 + (w.x1 - w.x0) * t + Math.sin(n) * back, y: w.height, z: w.z0 + (w.z1 - w.z0) * t + Math.cos(n) * back, yaw: n });
  }
  return out;
};

export const figuresFor = (garrison: number): number => Math.min(MAX_FIGURES, Math.ceil(Math.max(0, garrison) / MEN_PER_FIGURE));

export class FortProps {
  private readonly figure: Mesh;
  private readonly wood: StandardMaterial;
  private readonly iron: StandardMaterial;
  private readonly brick: StandardMaterial;
  private readonly chains = new Map<number, Mesh>();
  private key = "";

  constructor(private readonly scene: Scene) {
    const body = MeshBuilder.CreateCapsule("fort-man-body", { height: 1.5, radius: 0.24, tessellation: 6, subdivisions: 1 }, scene);
    body.position.y = 0.75;
    const head = MeshBuilder.CreateSphere("fort-man-head", { diameter: 0.3, segments: 3 }, scene);
    head.position.y = 1.62;
    this.figure = Mesh.MergeMeshes([body, head], true)!;
    this.figure.name = "fort-garrison";
    const coat = new StandardMaterial("fort-coat", scene);
    coat.specularColor = Color3.Black();
    this.figure.material = coat;
    this.figure.isPickable = false;
    this.figure.isVisible = false;
    this.wood = new StandardMaterial("fort-wood", scene);
    this.wood.diffuseColor = new Color3(0.3, 0.22, 0.14);
    this.wood.specularColor = Color3.Black();
    this.iron = new StandardMaterial("fort-chain-iron", scene);
    this.iron.diffuseColor = new Color3(0.1, 0.09, 0.08);
    this.brick = new StandardMaterial("fort-brick", scene);
    this.brick.diffuseColor = new Color3(0.45, 0.25, 0.17);
    this.brick.specularColor = Color3.Black();
    // The furnace's fire door glows.
    this.brick.emissiveColor = new Color3(0.05, 0.015, 0);
  }

  /** The shot furnace's mesh in fort space (parent it to the fort's root), or null. */
  furnace(def: FortClassDef): Mesh | null {
    const f = fortLayout(def).furnace;
    if (!f) return null;
    const oven = MeshBuilder.CreateBox("fort-furnace", { width: 4, height: 2.6, depth: 3.2 }, this.scene);
    oven.position.set(f.x, 1.3, f.z);
    const chimney = MeshBuilder.CreateCylinder("fort-furnace-chimney", { height: 4, diameter: 0.9, tessellation: 8 }, this.scene);
    chimney.position.set(f.x + 1.2, 4.4, f.z);
    const m = Mesh.MergeMeshes([oven, chimney], true)!;
    m.material = this.brick;
    m.isPickable = false;
    return m;
  }

  /** Top of the furnace's chimney (fort space), where its smoke rises. */
  static chimney(def: FortClassDef): { x: number; y: number; z: number } | null {
    const f = fortLayout(def).furnace;
    return f ? { x: f.x + 1.2, y: 6.6, z: f.z } : null;
  }

  /** The chain of a fort (built once; world space), shown while `up`. */
  chain(id: number, site: FortSite, up: boolean): void {
    const c = site.chain;
    if (!c) return;
    let m = this.chains.get(id);
    if (!m) {
      const len = Math.hypot(c.x1 - c.x0, c.z1 - c.z0);
      const floats = Math.max(4, Math.round(len / 30));
      // The chain droops between its log floats (a shallow catenary, a parabola at this sag).
      const path: Vector3[] = [];
      for (let i = 0; i <= floats * 6; i++) {
        const t = i / (floats * 6);
        const span = (t * floats) % 1;
        path.push(new Vector3(c.x0 + (c.x1 - c.x0) * t, 0.55 - 0.35 * 4 * span * (1 - span), c.z0 + (c.z1 - c.z0) * t));
      }
      const parts: Mesh[] = [MeshBuilder.CreateTube(`fort-chain-${id}`, { path, radius: 0.18, tessellation: 5 }, this.scene)];
      const yaw = Math.atan2(c.x1 - c.x0, c.z1 - c.z0);
      for (let k = 0; k <= floats; k++) {
        const t = k / floats;
        const log = MeshBuilder.CreateCylinder("fort-chain-float", { height: 5, diameter: 0.8, tessellation: 6 }, this.scene);
        log.rotation.set(Math.PI / 2, yaw + Math.PI / 2, 0);
        log.position.set(c.x0 + (c.x1 - c.x0) * t, 0.3, c.z0 + (c.z1 - c.z0) * t);
        parts.push(log);
      }
      m = Mesh.MergeMeshes(parts, true, true)!;
      m.material = this.iron;
      m.isPickable = false;
      for (const [x, z] of [[c.x0, c.z0], [c.x1, c.z1]] as const) {
        const post = MeshBuilder.CreateCylinder("fort-chain-post", { height: 6, diameter: 1.4, tessellation: 8 }, this.scene);
        post.position.set(x, 1.5, z);
        post.material = this.wood;
        post.isPickable = false;
      }
      this.chains.set(id, m);
    }
    m.isVisible = up;
  }

  /** The garrisons of all forts as one set of instances (rebuilt when a garrison or an owner changes). */
  garrisons(forts: readonly { id: number; def: FortClassDef; site: FortSite; garrison: number; faction: Faction }[]): void {
    const key = forts.map((f) => `${f.id}:${figuresFor(f.garrison)}:${f.faction}`).join(";");
    if (key === this.key) return;
    this.key = key;
    const mats: number[] = [];
    const cols: number[] = [];
    const m = new Matrix();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    for (const f of forts) {
      const facing = fortFacing(f.site);
      const coat = COATS[f.faction];
      for (const p of garrisonPosts(f.def, figuresFor(f.garrison))) {
        const w = fortToWorld(f.site, p.x, p.y, p.z);
        Quaternion.RotationYawPitchRollToRef(facing + p.yaw, 0, 0, q);
        Matrix.ComposeToRef(one, q, new Vector3(w.x, w.y, w.z), m);
        for (let k = 0; k < 16; k++) mats.push(m.m[k]!);
        cols.push(coat[0], coat[1], coat[2], 1);
      }
    }
    this.figure.isVisible = mats.length > 0;
    if (mats.length === 0) return;
    this.figure.thinInstanceSetBuffer("matrix", new Float32Array(mats), 16, true);
    this.figure.thinInstanceSetBuffer("color", new Float32Array(cols), 4, true);
  }

  /** Meshes for the renderer's lists (kept out of the sun shafts). */
  meshes(): Mesh[] {
    return [this.figure, ...this.chains.values()];
  }
}
