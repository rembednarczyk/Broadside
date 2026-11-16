import { type Entity, type FactionId } from "@broadside/sim";
import { Color3, DynamicTexture, Mesh, MeshBuilder, type Scene, StandardMaterial, TransformNode, Vector3, type ShadowGenerator } from "../babylon";
import { fortLayout } from "./fort-geometry";

/**
 * Shore forts: walls, towers and guns built from the class layout (merged into one stone mesh
 * per fort), a flag in the owner's colour, smoke and darkening as the walls are battered.
 */
const FLAG: Readonly<Record<FactionId, readonly [number, number, number]>> = {
  player: [0.62, 0.48, 0.22],
  crown: [0.55, 0.12, 0.1],
  republic: [0.15, 0.25, 0.5],
  empire: [0.7, 0.6, 0.2],
  pirates: [0.08, 0.08, 0.08],
};

const stoneMaterial = (scene: Scene): StandardMaterial => {
  const tex = new DynamicTexture("stone-tex", { width: 256, height: 256 }, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  c.fillStyle = "rgb(118,110,96)";
  c.fillRect(0, 0, 256, 256);
  // Ashlar courses: staggered blocks with dark joints (deterministic pattern).
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 8; col++) {
      const shade = 100 + ((row * 7 + col * 13) % 5) * 8;
      c.fillStyle = `rgb(${shade + 10},${shade + 4},${shade - 8})`;
      c.fillRect(col * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
    }
  }
  tex.update(true);
  const m = new StandardMaterial("stone", scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.03, 0.03, 0.03);
  return m;
};

interface FortVisual {
  readonly root: TransformNode;
  readonly body: Mesh;
  readonly flag: Mesh;
  readonly flagMat: StandardMaterial;
  faction: FactionId;
}

export class FortsView {
  private readonly views = new Map<number, FortVisual>();
  /** Called with the meshes of each new fort (the renderer keeps them out of the sun shafts). */
  onBuilt: (meshes: Mesh[]) => void = () => {};
  private stone: StandardMaterial | null = null;
  private iron: StandardMaterial | null = null;

  constructor(private readonly scene: Scene, private readonly shadows: ShadowGenerator | null) {}

  private build(e: Entity): FortVisual {
    const f = e.fort!;
    const scene = this.scene;
    this.stone ??= stoneMaterial(scene);
    if (!this.iron) {
      this.iron = new StandardMaterial("gun-iron", scene);
      this.iron.diffuseColor = new Color3(0.08, 0.08, 0.08);
    }
    const root = new TransformNode(`fort-${e.id}`, scene);
    root.position.set(f.site.x, f.site.y, f.site.z);
    // Face the sea: the fort's +z points away from its island's centre (towards open water).
    root.rotation.y = f.site.facing ?? Math.atan2(f.site.x, f.site.z);
    const layout = fortLayout(f.def);
    const parts: Mesh[] = [];
    for (const w of layout.walls) {
      const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      const b = MeshBuilder.CreateBox("wall", { width: w.thickness, height: w.height + 4, depth: len + w.thickness * 0.5 }, scene);
      b.position.set((w.x0 + w.x1) / 2, (w.height - 4) / 2, (w.z0 + w.z1) / 2);
      b.rotation.y = Math.atan2(w.x1 - w.x0, w.z1 - w.z0);
      parts.push(b);
    }
    for (const t of layout.towers) {
      const c = MeshBuilder.CreateCylinder("tower", { height: t.height + 4, diameter: t.radius * 2, tessellation: 14 }, scene);
      c.position.set(t.x, (t.height - 4) / 2, t.z);
      parts.push(c);
      // Crenellations around the top.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const m = MeshBuilder.CreateBox("merlon", { width: 1.2, height: 1.4, depth: 1.2 }, scene);
        m.position.set(t.x + Math.sin(a) * (t.radius - 0.5), t.height + 0.7, t.z + Math.cos(a) * (t.radius - 0.5));
        parts.push(m);
      }
    }
    const body = Mesh.MergeMeshes(parts, true, true)!;
    body.material = this.stone;
    body.parent = root;
    body.receiveShadows = true;
    this.shadows?.addShadowCaster(body);
    const guns = layout.guns.map((g) => {
      const barrel = MeshBuilder.CreateCylinder("fort-gun", { height: 3, diameter: 0.5, tessellation: 6 }, scene);
      barrel.rotation.x = Math.PI / 2;
      barrel.rotation.y = g.angle;
      barrel.position.set(g.x + Math.sin(g.angle) * 1.2, g.y, g.z + Math.cos(g.angle) * 1.2);
      return barrel;
    });
    const top = layout.towers.reduce((a, t) => (t.height > a.height ? t : a), { x: 0, z: 0, radius: 0, height: f.def.height });
    const pole = MeshBuilder.CreateCylinder("flagpole", { height: 10, diameter: 0.25, tessellation: 5 }, scene);
    pole.position.set(top.x, top.height + 5, top.z);
    // Guns and the flagpole share the iron: one mesh.
    const iron = Mesh.MergeMeshes([...guns, pole], true, true)!;
    iron.material = this.iron;
    iron.parent = root;
    const flagMat = new StandardMaterial(`fort-flag-${e.id}`, scene);
    flagMat.backFaceCulling = false;
    const flag = MeshBuilder.CreatePlane("fort-flag", { width: 5, height: 3 }, scene);
    flag.position.set(top.x + 2.6, top.height + 8.5, top.z);
    flag.material = flagMat;
    flag.parent = root;
    const v: FortVisual = { root, body, flag, flagMat, faction: f.faction };
    this.onBuilt([body, iron, flag]);
    this.paintFlag(v, f.faction);
    return v;
  }

  private paintFlag(v: FortVisual, faction: FactionId): void {
    const c = FLAG[faction];
    v.flagMat.diffuseColor = new Color3(c[0], c[1], c[2]);
    v.flagMat.emissiveColor = new Color3(c[0] * 0.3, c[1] * 0.3, c[2] * 0.3);
    v.faction = faction;
  }

  /** Syncs the forts; returns burning points (for smoke and flames) of battered forts. */
  sync(forts: readonly Entity[], time: number): Vector3[] {
    const burning: Vector3[] = [];
    for (const e of forts) {
      let v = this.views.get(e.id);
      if (!v) {
        v = this.build(e);
        this.views.set(e.id, v);
      }
      const f = e.fort!;
      if (f.faction !== v.faction) this.paintFlag(v, f.faction);
      v.flag.rotation.y = Math.sin(time * 1.3 + e.id) * 0.3;
      const health = f.hp / f.def.hp;
      if (health < 0.6) burning.push(new Vector3(f.site.x, f.site.y + f.def.height, f.site.z));
    }
    return burning;
  }
}
