import { type Entity, type FactionId, type ShipModel, setFactor } from "@broadside/sim";
import { rotateInv, vec3, windVector } from "@broadside/core";
import { Color3, DynamicTexture, Mesh, MeshBuilder, Quaternion, type Scene, StandardMaterial, TransformNode, Vector3, VertexData, type ShadowGenerator } from "../babylon";
import { type Geometry, deckGeometry, hullGeometry } from "./hull-geometry";
import { liveryOps, paint } from "./hull-livery";
import { SAIL_COLS, SAIL_ROWS, type SailOutline, sailIndices, sailPositions } from "./sail-geometry";

/**
 * Visual of one ship, built from its class model (hull lines, masts, sails) and synced each frame
 * from the simulation entity. Root node = centre of mass; children are offset by -com so the hull
 * stays in hull space (origin at the waterline).
 */
const LIVERY: Readonly<Record<FactionId, readonly [number, number, number]>> = {
  player: [0.78, 0.6, 0.25],
  crown: [0.75, 0.12, 0.1],
  republic: [0.15, 0.3, 0.7],
  empire: [0.85, 0.75, 0.2],
  pirates: [0.12, 0.12, 0.12],
};

interface SailView {
  readonly mesh: Mesh;
  readonly node: TransformNode;
  readonly outline: SailOutline;
  readonly mast: number;
  readonly sail: number;
  readonly positions: Float32Array;
  readonly yard: Mesh | null;
}

export interface ShipMaterials {
  readonly hull: StandardMaterial;
  readonly deck: StandardMaterial;
  readonly wood: StandardMaterial;
  readonly sail: StandardMaterial;
  readonly rope: StandardMaterial;
  readonly flag: Readonly<Record<FactionId, StandardMaterial>>;
}

export const createShipMaterials = (scene: Scene): ShipMaterials => {
  const hull = new StandardMaterial("hull", scene);
  hull.diffuseColor = Color3.White();
  hull.specularColor = new Color3(0.08, 0.08, 0.08);
  hull.backFaceCulling = false;
  hull.twoSidedLighting = true;
  const deck = new StandardMaterial("deck", scene);
  deck.diffuseColor = new Color3(0.66, 0.56, 0.42);
  deck.specularColor = new Color3(0.04, 0.04, 0.04);
  deck.backFaceCulling = false;
  deck.twoSidedLighting = true;
  const wood = new StandardMaterial("spar", scene);
  wood.diffuseColor = new Color3(0.36, 0.25, 0.14);
  wood.specularColor = new Color3(0.05, 0.05, 0.05);
  const sail = new StandardMaterial("sail", scene);
  sail.diffuseColor = new Color3(0.93, 0.9, 0.82);
  sail.specularColor = new Color3(0.02, 0.02, 0.02);
  sail.backFaceCulling = false;
  sail.twoSidedLighting = true;
  sail.emissiveColor = new Color3(0.12, 0.11, 0.1);
  const rope = new StandardMaterial("rope", scene);
  rope.diffuseColor = new Color3(0.12, 0.1, 0.08);
  const flag = Object.fromEntries(
    (Object.keys(LIVERY) as FactionId[]).map((f) => {
      const m = new StandardMaterial(`flag-${f}`, scene);
      const c = LIVERY[f];
      m.diffuseColor = new Color3(c[0], c[1], c[2]);
      m.emissiveColor = new Color3(c[0] * 0.3, c[1] * 0.3, c[2] * 0.3);
      m.backFaceCulling = false;
      return [f, m];
    }),
  ) as Record<FactionId, StandardMaterial>;
  return { hull, deck, wood, sail, rope, flag };
};

const outlinesFor = (model: ShipModel, mastIndex: number): SailOutline[] => {
  const h = model.def.hull;
  const mast = model.def.masts[mastIndex]!;
  let foreAftSeen = 0;
  return mast.sails.map((s) => {
    if (s.rig === "square") {
      const height = mast.height * 0.62;
      return { shape: "square" as const, width: s.area / height / 0.94, height, foot: h.freeboard + mast.height * 0.18 };
    }
    foreAftSeen++;
    if (foreAftSeen === 1 && mast.sails.filter((x) => x.rig === "foreAft").length >= 1 && s.ceHeight >= Math.max(...mast.sails.filter((x) => x.rig === "foreAft").map((x) => x.ceHeight))) {
      const height = mast.height * 0.55;
      return { shape: "gaff" as const, width: s.area / (height * 0.85), height, foot: h.freeboard + 1.4 };
    }
    const width = h.length / 2 - mast.z + h.length * 0.15;
    return { shape: "jib" as const, width, height: (2 * s.area) / width, foot: h.freeboard + 0.6 };
  });
};

export class ShipView {
  readonly root: TransformNode;
  private readonly sails: SailView[] = [];
  private readonly masts: Mesh[] = [];
  private readonly flag: Mesh;
  private readonly flagPositions: Float32Array;

  constructor(scene: Scene, readonly entityId: number, model: ShipModel, faction: FactionId, mats: ShipMaterials, shadows: ShadowGenerator | null) {
    this.root = new TransformNode(`ship-${entityId}`, scene);
    this.root.rotationQuaternion = new Quaternion();
    const hullSpace = new TransformNode(`ship-${entityId}-hull`, scene);
    hullSpace.parent = this.root;
    hullSpace.position = new Vector3(-model.com.x, -model.com.y, -model.com.z);
    const hullMesh = this.buildMesh(scene, `hull-${entityId}`, hullGeometry(model.def.hull), this.liveryMaterial(scene, model, faction, mats));
    hullMesh.parent = hullSpace;
    shadows?.addShadowCaster(hullMesh);
    const deck = this.buildMesh(scene, `deck-${entityId}`, deckGeometry(model.def.hull), mats.deck);
    deck.parent = hullSpace;
    model.def.masts.forEach((mast, i) => {
      const m = MeshBuilder.CreateCylinder(`mast-${entityId}-${i}`, { height: mast.height, diameterTop: 0.18, diameterBottom: 0.45 + model.def.hull.beam * 0.03, tessellation: 8 }, scene);
      m.material = mats.wood;
      m.parent = hullSpace;
      m.position = new Vector3(0, model.def.hull.freeboard + mast.height / 2 - 0.5, mast.z);
      shadows?.addShadowCaster(m);
      this.masts.push(m);
      outlinesFor(model, i).forEach((outline, j) => this.sails.push(this.buildSail(scene, hullSpace, mast.z, outline, i, j, mats, shadows)));
    });
    this.buildRigging(scene, hullSpace, model, mats);
    const first = model.def.masts.reduce((a, b) => (b.height > a.height ? b : a));
    const flag = this.buildFlag(scene, mats.flag[faction]);
    flag.mesh.parent = hullSpace;
    flag.mesh.position = new Vector3(0, model.def.hull.freeboard + first.height - 0.3, first.z);
    this.flag = flag.mesh;
    this.flagPositions = flag.positions;
  }

  private buildMesh(scene: Scene, name: string, g: Geometry, material: StandardMaterial): Mesh {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = g.positions;
    data.indices = g.indices;
    data.uvs = g.uvs;
    const normals: number[] = [];
    VertexData.ComputeNormals(g.positions, g.indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.receiveShadows = true;
    return mesh;
  }

  /** One painted material per class and faction, shared by every ship that wears it (Flyweight). */
  private liveryMaterial(scene: Scene, model: ShipModel, faction: FactionId, mats: ShipMaterials): StandardMaterial {
    const key = `livery-${model.def.id}-${faction}`;
    const cached = scene.getMaterialByName(key);
    if (cached) return cached as StandardMaterial;
    const tex = new DynamicTexture(key, { width: 1024, height: 256 }, scene, true);
    const ctx = tex.getContext();
    const gunZ = model.guns.filter((g) => g.kind === "broadside" && g.side === "starboard").map((g) => g.pos.z + model.com.z);
    paint(ctx, liveryOps({ hull: model.def.hull, gunDeck: model.def.guns.find((g) => g.kind === "broadside")?.deckHeight ?? 1.4, gunZ, stripe: LIVERY[faction], seed: key }), 1024, 256);
    tex.update(true);
    const m = mats.hull.clone(key) as StandardMaterial;
    m.diffuseTexture = tex;
    return m;
  }

  private buildSail(scene: Scene, parent: TransformNode, mastZ: number, outline: SailOutline, mast: number, sail: number, mats: ShipMaterials, shadows: ShadowGenerator | null): SailView {
    const node = new TransformNode(`sail-node-${this.entityId}-${mast}-${sail}`, scene);
    node.parent = parent;
    node.position = new Vector3(0, 0, mastZ);
    const positions = new Float32Array((SAIL_COLS + 1) * (SAIL_ROWS + 1) * 3);
    sailPositions(outline, 1, 0.5, positions);
    const mesh = new Mesh(`sail-${this.entityId}-${mast}-${sail}`, scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = sailIndices();
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, data.indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh, true);
    mesh.material = mats.sail;
    mesh.parent = node;
    shadows?.addShadowCaster(mesh);
    let yard: Mesh | null = null;
    if (outline.shape === "square") {
      yard = MeshBuilder.CreateCylinder(`yard-${this.entityId}-${mast}-${sail}`, { height: outline.width * 1.08, diameter: 0.22, tessellation: 6 }, scene);
      yard.rotation.x = Math.PI / 2;
      yard.position = new Vector3(0, outline.foot + outline.height, 0);
      yard.material = mats.wood;
      yard.parent = node;
    } else if (outline.shape === "gaff") {
      yard = MeshBuilder.CreateCylinder(`boom-${this.entityId}-${mast}-${sail}`, { height: outline.width, diameter: 0.2, tessellation: 6 }, scene);
      yard.rotation.x = Math.PI / 2;
      yard.position = new Vector3(0, outline.foot, -outline.width / 2);
      yard.material = mats.wood;
      yard.parent = node;
    }
    return { mesh, node, outline, mast, sail, positions, yard };
  }

  private buildRigging(scene: Scene, parent: TransformNode, model: ShipModel, mats: ShipMaterials): void {
    const h = model.def.hull;
    const lines: Vector3[][] = [];
    for (const mast of model.def.masts) {
      const top = new Vector3(0, h.freeboard + mast.height * 0.92, mast.z);
      for (const sx of [-1, 1]) for (const dz of [-1.2, 0, 1.2]) lines.push([top, new Vector3((sx * h.beam) / 2, h.freeboard + 0.9, mast.z + dz)]);
      lines.push([top, new Vector3(0, h.freeboard + 1, h.length / 2 + h.length * 0.12)]);
      lines.push([top, new Vector3(0, h.freeboard + 1.2, -h.length / 2)]);
    }
    const bowsprit = MeshBuilder.CreateCylinder(`bowsprit-${this.entityId}`, { height: h.length * 0.22, diameter: 0.28, tessellation: 6 }, scene);
    bowsprit.rotation.x = Math.PI / 2 - 0.25;
    bowsprit.position = new Vector3(0, h.freeboard + h.sheer + 0.9, h.length / 2 + h.length * 0.06);
    bowsprit.material = mats.wood;
    bowsprit.parent = parent;
    const rig = MeshBuilder.CreateLineSystem(`rigging-${this.entityId}`, { lines }, scene);
    rig.color = new Color3(0.1, 0.08, 0.06);
    rig.parent = parent;
    rig.isPickable = false;
  }

  private buildFlag(scene: Scene, material: StandardMaterial): { mesh: Mesh; positions: Float32Array } {
    const cols = 6;
    const positions = new Float32Array((cols + 1) * 2 * 3);
    const indices: number[] = [];
    for (let c = 0; c < cols; c++) indices.push(c, c + cols + 1, c + 1, c + 1, c + cols + 1, c + cols + 2);
    const mesh = new Mesh(`flag-${this.entityId}`, scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.applyToMesh(mesh, true);
    mesh.material = material;
    return { mesh, positions };
  }

  sync(e: Entity, windDirection: number, windSpeed: number, time: number): void {
    const b = e.body!;
    const s = e.ship!;
    this.root.position.set(b.pos.x, b.pos.y, b.pos.z);
    this.root.rotationQuaternion!.set(b.rot.x, b.rot.y, b.rot.z, b.rot.w);
    const tw = windVector(windDirection, windSpeed);
    const aw = rotateInv(b.rot, vec3(tw.x - b.vel.x, 0, tw.z - b.vel.z));
    for (const v of this.sails) {
      const chord = s.sailChord[v.mast]![v.sail]!;
      // Sail chord along node +z: Babylon's rotation.y maps +z to (sin a, 0, cos a), the sim's heading convention.
      v.node.rotation.y = chord;
      const normalX = Math.cos(v.node.rotation.y);
      const normalZ = -Math.sin(v.node.rotation.y);
      const lee = Math.sign(aw.x * normalX + aw.z * normalZ) || 1;
      const set = s.mastHp[v.mast]! > 0 ? Math.min(1, s.sailSet[v.mast]! / setFactor(3, false)) : 0;
      const fill = Math.min(1.4, s.sailFill[v.mast]![v.sail]!);
      v.mesh.setEnabled(set > 0.03);
      v.yard?.setEnabled(s.mastHp[v.mast]! > 0);
      if (set > 0.03) {
        sailPositions(v.outline, set, lee * (0.25 + 0.75 * fill), v.positions);
        v.mesh.updateVerticesData("position", v.positions);
      }
    }
    this.masts.forEach((m, i) => m.setEnabled(s.mastHp[i]! > 0));
    this.updateFlag(aw.x, aw.z, time);
  }

  private updateFlag(awx: number, awz: number, time: number): void {
    const cols = (this.flagPositions.length / 6) - 1;
    const len = Math.hypot(awx, awz) || 1;
    const dx = awx / len;
    const dz = awz / len;
    let k = 0;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c <= cols; c++) {
        const t = c / cols;
        const flap = Math.sin(time * 7 + t * 5) * 0.18 * t;
        this.flagPositions[k++] = dx * t * 2.4 - dz * flap;
        this.flagPositions[k++] = r * 1.4 - t * 0.1;
        this.flagPositions[k++] = dz * t * 2.4 + dx * flap;
      }
    }
    this.flag.updateVerticesData("position", this.flagPositions);
  }

  dispose(): void {
    this.root.dispose();
  }
}
