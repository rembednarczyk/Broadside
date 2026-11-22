import { type Faction, type FortClassDef, fortFacing, fortLayout, fortToWorld } from "@broadside/core";
import { type Entity } from "@broadside/sim";
import { Color3, DynamicTexture, Matrix, Mesh, MeshBuilder, Quaternion, type Scene, StandardMaterial, TransformNode, Vector3, type ShadowGenerator } from "../babylon";
import { buildFortStone, towerTop } from "./fort-build";
import { type PartState, partStates, stoneShade } from "./fort-damage";
import { flagCloth, flagMaterial, rippleFlag } from "./fort-flag";
import { FortMarks } from "./fort-marks";
import { FortProps } from "./fort-props";

/**
 * Shore forts: the stone of each built from the class layout and the state of its parts
 * (fort-build, fort-damage: breaches and rubble as the walls are battered, rebuilt when a part
 * changes state), the guns and mortars of every fort as thin instances of two meshes (Flyweight;
 * a dismounted piece is gone from its embrasure), scars where shot struck (fort-marks), the
 * stone darkening with the damage, a cloth flag streaming down the wind, white when the fort has
 * struck, hauled down and run up again in the new colours when it changes hands; smoke and fire
 * at the breaches. Only the forts near the camera cast shadows (beta test 22.11: all twenty did,
 * 83 extra draw calls on ultra).
 */
/** A point that burns (a breach afire) or smokes (a furnace's chimney). */
export interface FortFire {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly chimney?: boolean;
}

const SHADOW_NEAR = 600;
const SHADOW_HYSTERESIS = 50;
/** Flags ripple only this close (m): beyond, the cloth is a few pixels. */
const FLAG_NEAR = 900;
/** Seconds to haul the colours down and run the new ones up. */
const HAUL = 3;

const stoneTexture = (scene: Scene): DynamicTexture => {
  const tex = new DynamicTexture("stone-tex", { width: 256, height: 256 }, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  c.fillStyle = "rgb(118,110,96)";
  c.fillRect(0, 0, 256, 256);
  // Ashlar courses: 8 blocks by 16 courses per repeat (1.2 × 0.6 m at 9.6 m), staggered, deterministic shades.
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 9; col++) {
      const shade = 100 + ((row * 7 + col * 13) % 5) * 8;
      c.fillStyle = `rgb(${shade + 10},${shade + 4},${shade - 8})`;
      c.fillRect(col * 32 - (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
    }
  }
  tex.update(true);
  return tex;
};

interface FortVisual {
  readonly root: TransformNode;
  body: Mesh;
  states: PartState[];
  readonly stone: StandardMaterial;
  readonly flag: Mesh;
  readonly pole: Mesh;
  readonly marks: FortMarks;
  /** Colours flying now, and the colours to run up (hauling while `haul` > 0). */
  flying: Faction | "struck";
  want: Faction | "struck";
  haul: number;
  shade: number;
  near: boolean;
}

const gunMesh = (scene: Scene, iron: StandardMaterial): Mesh => {
  // A truck carriage under a long gun (beta test 22.11: bare barrels lay on the walls).
  const barrel = MeshBuilder.CreateCylinder("fort-gun-barrel", { height: 3, diameterTop: 0.38, diameterBottom: 0.55, tessellation: 8 }, scene);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.55, 0.9);
  const carriage = MeshBuilder.CreateBox("fort-gun-carriage", { width: 1.1, height: 0.6, depth: 1.8 }, scene);
  carriage.position.set(0, 0.2, 0.1);
  const m = Mesh.MergeMeshes([barrel, carriage], true)!;
  m.name = "fort-guns";
  m.material = iron;
  return m;
};

const mortarMesh = (scene: Scene, iron: StandardMaterial): Mesh => {
  // A squat, thick-walled piece on a timber bed, laid at 45 degrees.
  const piece = MeshBuilder.CreateCylinder("fort-mortar-piece", { height: 1.4, diameterTop: 0.9, diameterBottom: 1.15, tessellation: 10 }, scene);
  piece.rotation.x = Math.PI / 4;
  piece.position.set(0, 0.9, 0.2);
  const bed = MeshBuilder.CreateBox("fort-mortar-bed", { width: 1.6, height: 0.5, depth: 2.2 }, scene);
  bed.position.y = 0.25;
  const m = Mesh.MergeMeshes([piece, bed], true)!;
  m.name = "fort-mortars";
  m.material = iron;
  return m;
};

export class FortsView {
  private readonly views = new Map<number, FortVisual>();
  /** Called with the meshes of each new fort (the renderer keeps them out of the sun shafts). */
  onBuilt: (meshes: Mesh[]) => void = () => {};
  private stoneTex: DynamicTexture | null = null;
  private iron: StandardMaterial | null = null;
  private guns: Mesh | null = null;
  private mortars: Mesh | null = null;
  /** What the gun instances were last built from (rebuilt when a piece is dismounted or remounted). */
  private pieces = "";
  private readonly props: FortProps;

  constructor(private readonly scene: Scene, private readonly shadows: ShadowGenerator | null) {
    this.props = new FortProps(scene);
  }

  private ironMat(): StandardMaterial {
    if (!this.iron) {
      this.iron = new StandardMaterial("gun-iron", this.scene);
      this.iron.diffuseColor = new Color3(0.08, 0.08, 0.08);
      this.iron.specularColor = new Color3(0.15, 0.15, 0.15);
    }
    return this.iron;
  }

  private build(e: Entity): FortVisual {
    const f = e.fort!;
    const scene = this.scene;
    this.stoneTex ??= stoneTexture(scene);
    const root = new TransformNode(`fort-${e.id}`, scene);
    root.position.set(f.site.x, f.site.y, f.site.z);
    root.rotation.y = fortFacing(f.site);
    root.computeWorldMatrix(true);
    const stone = new StandardMaterial(`stone-${e.id}`, scene);
    stone.diffuseTexture = this.stoneTex;
    stone.specularColor = new Color3(0.03, 0.03, 0.03);
    const states = partStates(f.def, f.scars ?? []);
    const body = this.stone(root, f.def, states, stone);
    const top = towerTop(f.def, states);
    const pole = MeshBuilder.CreateCylinder("flagpole", { height: 10, diameter: 0.25, tessellation: 5 }, scene);
    pole.material = this.ironMat();
    pole.parent = root;
    pole.position.set(top.x, top.height + 5, top.z);
    const flag = flagCloth(scene, `fort-flag-${e.id}`);
    flag.parent = root;
    flag.position.set(top.x, top.height + 7, top.z);
    const who = f.silenced ? "struck" : f.faction;
    flag.material = flagMaterial(scene, who);
    const v: FortVisual = { root, body, states, stone, flag, pole, marks: new FortMarks(scene, root, f.def), flying: who, want: who, haul: 0, shade: 1, near: false };
    const furnace = this.props.furnace(f.def);
    if (furnace) furnace.parent = root;
    this.onBuilt([body, pole, flag, ...(furnace ? [furnace] : [])]);
    return v;
  }

  private stone(root: TransformNode, def: FortClassDef, states: readonly PartState[], mat: StandardMaterial): Mesh {
    const body = buildFortStone(this.scene, def, states);
    body.material = mat;
    body.parent = root;
    body.receiveShadows = true;
    body.isPickable = false;
    body.computeWorldMatrix(true);
    body.freezeWorldMatrix();
    return body;
  }

  /** A shot struck a fort's stone at a world point. */
  shotHit(fortId: number, at: { readonly x: number; readonly y: number; readonly z: number }, damage: number): void {
    this.views.get(fortId)?.marks.add(at, Math.min(2.2, 1 + damage * 0.04));
  }

  /** The guns and mortars still mounted, as world matrices of the two piece meshes. */
  private syncPieces(forts: readonly Entity[]): void {
    const key = forts.map((e) => `${e.id}:${e.fort!.guns.map((g) => (g < 0 ? 0 : 1)).join("")}/${e.fort!.mortars.map((g) => (g < 0 ? 0 : 1)).join("")}`).join(";");
    if (key === this.pieces) return;
    this.pieces = key;
    if (!this.guns || !this.mortars) {
      this.guns = gunMesh(this.scene, this.ironMat());
      this.mortars = mortarMesh(this.scene, this.ironMat());
      for (const m of [this.guns, this.mortars]) m.isPickable = false;
      this.onBuilt([this.guns, this.mortars]);
    }
    const gm: number[] = [];
    const mm: number[] = [];
    const m = new Matrix();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    for (const e of forts) {
      const f = e.fort!;
      const l = fortLayout(f.def);
      const facing = fortFacing(f.site);
      l.guns.forEach((g, i) => {
        if ((f.guns[i] ?? -1) < 0) return;
        const p = fortToWorld(f.site, g.x, g.y - 0.5, g.z);
        Quaternion.RotationYawPitchRollToRef(facing + g.angle, 0, 0, q);
        Matrix.ComposeToRef(one, q, new Vector3(p.x, p.y, p.z), m);
        for (let k = 0; k < 16; k++) gm.push(m.m[k]!);
      });
      l.mortars.forEach((b, i) => {
        if ((f.mortars[i] ?? -1) < 0) return;
        const p = fortToWorld(f.site, b.x, b.y - 1, b.z);
        Quaternion.RotationYawPitchRollToRef(facing, 0, 0, q);
        Matrix.ComposeToRef(one, q, new Vector3(p.x, p.y, p.z), m);
        for (let k = 0; k < 16; k++) mm.push(m.m[k]!);
      });
    }
    for (const [mesh, data] of [[this.guns, gm], [this.mortars, mm]] as const) {
      mesh.isVisible = data.length > 0;
      if (data.length > 0) mesh.thinInstanceSetBuffer("matrix", new Float32Array(data), 16, true);
    }
  }

  private syncStone(e: Entity, v: FortVisual): void {
    const f = e.fort!;
    const states = partStates(f.def, f.scars ?? []);
    if (states.some((s, i) => s !== v.states[i])) {
      const wasNear = v.near;
      if (wasNear) this.shadows?.removeShadowCaster(v.body);
      v.body.dispose();
      v.body = this.stone(v.root, f.def, states, v.stone);
      v.states = states;
      if (wasNear) this.shadows?.addShadowCaster(v.body);
      const top = towerTop(f.def, states);
      v.pole.position.set(top.x, top.height + 5, top.z);
      v.flag.position.set(top.x, top.height + 7, top.z);
      this.onBuilt([v.body]);
    }
    const shade = stoneShade(f.hp / f.def.hp);
    if (Math.abs(shade - v.shade) > 0.01) {
      v.shade = shade;
      v.stone.diffuseColor.set(shade, shade, shade * 0.97);
    }
  }

  private syncFlag(e: Entity, v: FortVisual, time: number, wind: { x: number; z: number }, dt: number, close: boolean): void {
    const f = e.fort!;
    const want = f.silenced ? "struck" : f.faction;
    if (want !== v.want) {
      v.want = want;
      v.haul = HAUL;
    }
    const top = towerTop(f.def, v.states);
    if (v.haul > 0) {
      v.haul = Math.max(0, v.haul - dt);
      // Down for the first half, the new colours bent on at the foot, up for the second.
      const k = v.haul / HAUL;
      if (k < 0.5 && v.flying !== v.want) {
        v.flying = v.want;
        v.flag.material = flagMaterial(this.scene, v.flying);
      }
      v.flag.position.y = top.height + 7 - Math.sin(k * Math.PI) * 6;
    }
    // Down the wind, in the root's frame.
    const speed = Math.hypot(wind.x, wind.z);
    v.flag.rotation.y = Math.atan2(wind.x, wind.z) - v.root.rotation.y - Math.PI / 2;
    if (close) rippleFlag(v.flag, time, speed, e.id * 1.7);
  }

  private syncShadow(v: FortVisual, d: number): void {
    const near = v.near ? d < SHADOW_NEAR + SHADOW_HYSTERESIS : d < SHADOW_NEAR;
    if (near === v.near) return;
    v.near = near;
    if (near) this.shadows?.addShadowCaster(v.body);
    else this.shadows?.removeShadowCaster(v.body);
  }

  /**
   * Syncs the forts; returns burning points (for smoke and flames): each breach, and the most
   * battered part of a fort below 60% of its walls when nothing is breached yet.
   */
  sync(forts: readonly Entity[], time: number, eye: { x: number; z: number } = { x: 0, z: 0 }, wind: { x: number; z: number } = { x: 0, z: 1 }, dt = 1 / 60): FortFire[] {
    const burning: FortFire[] = [];
    for (const e of forts) {
      let v = this.views.get(e.id);
      if (!v) {
        v = this.build(e);
        this.views.set(e.id, v);
      }
      const f = e.fort!;
      const d = Math.hypot(f.site.x - eye.x, f.site.z - eye.z);
      this.syncStone(e, v);
      this.syncFlag(e, v, time, wind, dt, d < FLAG_NEAR);
      this.syncShadow(v, d);
      burning.push(...this.firesOf(e, v));
      // The furnace's chimney smokes while it burns.
      const ch = f.furnace ? FortProps.chimney(f.def) : null;
      if (ch) burning.push({ ...fortToWorld(f.site, ch.x, ch.y, ch.z), chimney: true });
      // The chain is up while the fort fights and it holds; else it lies on the bottom.
      this.props.chain(e.id, f.site, !!f.site.chain && f.chain > 0 && !f.silenced);
    }
    this.syncPieces(forts);
    this.props.garrisons(forts.map((e) => ({ id: e.id, def: e.fort!.def, site: e.fort!.site, garrison: e.fort!.garrison, faction: e.fort!.faction })));
    if (!this.propsListed) {
      this.propsListed = true;
      this.onBuilt(this.props.meshes());
    }
    return burning;
  }

  private propsListed = false;

  private firesOf(e: Entity, v: FortVisual): Vector3[] {
    const f = e.fort!;
    const l = fortLayout(f.def);
    const at = (lx: number, ly: number, lz: number): Vector3 => {
      const p = fortToWorld(f.site, lx, ly, lz);
      return new Vector3(p.x, p.y, p.z);
    };
    const out: Vector3[] = [];
    v.states.forEach((s, i) => {
      if (s !== 2) return;
      const w = l.walls[i];
      const t = l.towers[i - l.walls.length];
      if (w) out.push(at((w.x0 + w.x1) / 2, w.height * 0.4, (w.z0 + w.z1) / 2));
      else if (t) out.push(at(t.x, t.height * 0.65, t.z));
    });
    if (out.length === 0 && f.hp / f.def.hp < 0.6) {
      const scars = f.scars ?? [];
      const worst = scars.reduce((b, s, i) => (s > (scars[b] ?? 0) ? i : b), 0);
      const w = l.walls[worst];
      const t = l.towers[worst - l.walls.length];
      if (w) out.push(at((w.x0 + w.x1) / 2, w.height + 1, (w.z0 + w.z1) / 2));
      else if (t) out.push(at(t.x, t.height + 1, t.z));
    }
    return out;
  }
}
