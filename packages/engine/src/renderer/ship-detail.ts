import { type ShipModel } from "@broadside/sim";
import { type HullShape, createRng, deckHeight, halfBreadth, hashString, range, stationZ } from "@broadside/core";
import { Color3, DynamicTexture, Matrix, Vector4, type Mesh, MeshBuilder, type Scene, StandardMaterial, type TransformNode, Vector3, type ShadowGenerator } from "../babylon";

/**
 * Period detail that sells the silhouette (visual reference, decyzje 16.11): ratlines on the
 * shrouds, fighting tops, raised quarterdeck and forecastle, rail posts, stern lanterns and crew
 * figures. Repeated pieces are thin instances of one mesh each (Flyweight); placement is
 * generated from the class with a seeded generator, so a ship always looks the same.
 */
export interface DetailMaterials {
  readonly wood: StandardMaterial;
  readonly castle: StandardMaterial;
  readonly dark: StandardMaterial;
  readonly crew: StandardMaterial;
  readonly lantern: StandardMaterial;
}

export const createDetailMaterials = (scene: Scene): DetailMaterials => {
  const mat = (name: string, c: [number, number, number], emissive = false): StandardMaterial => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = new Color3(...c);
    m.specularColor = new Color3(0.03, 0.03, 0.03);
    if (emissive) {
      m.emissiveColor = new Color3(...c);
      m.disableLighting = true;
    }
    return m;
  };
  return { wood: mat("detail-wood", [0.3, 0.2, 0.12]), castle: castleMaterial(scene), dark: mat("detail-dark", [0.12, 0.09, 0.07]), crew: mat("detail-crew", [0.38, 0.3, 0.24]), lantern: mat("detail-lantern", [1.6, 1.1, 0.55], true) };
};

/**
 * Castle sides: dark planking, a row of stern-gallery windows glowing warm (emissive, so the
 * lanterns read at dusk as in the reference) and a moulding band. One material for all castles.
 */
const castleMaterial = (scene: Scene): StandardMaterial => {
  const tex = new DynamicTexture("castle-tex", { width: 256, height: 128 }, scene, true);
  const glow = new DynamicTexture("castle-glow", { width: 256, height: 128 }, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  const g = glow.getContext() as CanvasRenderingContext2D;
  c.fillStyle = "rgb(70,50,34)";
  c.fillRect(0, 0, 256, 128);
  c.fillStyle = "rgba(25,16,10,0.7)";
  for (let y = 8; y < 128; y += 14) c.fillRect(0, y, 256, 2);
  c.fillStyle = "rgb(120,90,40)";
  c.fillRect(0, 10, 256, 6);
  g.fillStyle = "rgb(0,0,0)";
  g.fillRect(0, 0, 256, 128);
  for (let x = 14; x < 256; x += 40) {
    c.fillStyle = "rgb(20,14,10)";
    c.fillRect(x - 2, 40, 28, 40);
    c.fillStyle = "rgb(150,110,60)";
    c.fillRect(x, 42, 24, 36);
    g.fillStyle = "rgb(255,170,80)";
    g.fillRect(x + 2, 44, 20, 32);
    c.fillStyle = "rgb(20,14,10)";
    c.fillRect(x + 11, 42, 2, 36);
    c.fillRect(x, 59, 24, 2);
  }
  tex.update(true);
  glow.update(true);
  const m = new StandardMaterial("castle", scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = glow;
  m.emissiveColor = new Color3(0.55, 0.45, 0.35);
  m.specularColor = new Color3(0.03, 0.03, 0.03);
  return m;
};

/** Ships with a raised quarterdeck (and a forecastle from the frigate up). */
const castles = (id: string): { quarter: number; fore: number; poop: number } =>
  ({ brig: { quarter: 0.22, fore: 0, poop: 0 }, bomb: { quarter: 0.25, fore: 0, poop: 0 }, galleon: { quarter: 0.36, fore: 0.2, poop: 0.18 }, frigate: { quarter: 0.3, fore: 0.18, poop: 0 }, liner: { quarter: 0.34, fore: 0.2, poop: 0.12 } })[id] ?? { quarter: 0, fore: 0, poop: 0 };

const CASTLE_HEIGHT = 2.3;

const instances = (mesh: Mesh, matrices: Matrix[]): void => {
  const buf = new Float32Array(matrices.length * 16);
  matrices.forEach((m, i) => buf.set(m.m, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
};

const deckAt = (h: HullShape, z: number): number => deckHeight(h, z / h.length + 0.5);
const beamAt = (h: HullShape, z: number): number => halfBreadth(h, z / h.length + 0.5, deckAt(h, z) - 1e-3);

export class ShipDetail {
  private readonly crew: Mesh;
  private readonly crewSpots: Matrix[];

  constructor(scene: Scene, parent: TransformNode, key: string, model: ShipModel, mats: DetailMaterials, shadows: ShadowGenerator | null) {
    const h = model.def.hull;
    const rng = createRng(hashString(key));
    const c = castles(model.def.id);
    const castleMeshes: Mesh[] = [];
    if (c.quarter > 0) castleMeshes.push(this.castle(scene, parent, h, -h.length / 2, -h.length / 2 + h.length * c.quarter, mats.castle, "quarter"));
    if (c.poop > 0) castleMeshes.push(this.castle(scene, parent, h, -h.length / 2, -h.length / 2 + h.length * c.poop, mats.castle, "poop", CASTLE_HEIGHT));
    if (c.fore > 0) castleMeshes.push(this.castle(scene, parent, h, h.length / 2 - h.length * c.fore, h.length * 0.47, mats.castle, "fore"));
    for (const m of castleMeshes) shadows?.addShadowCaster(m);
    this.ratlines(scene, parent, model);
    this.rails(scene, parent, h, mats, c);
    this.lanterns(scene, parent, h, mats, c.quarter > 0 ? CASTLE_HEIGHT : 0);
    this.crew = MeshBuilder.CreateCapsule(`crew-${key}`, { height: 1.7, radius: 0.24, tessellation: 6, subdivisions: 1 }, scene);
    this.crew.material = mats.crew;
    this.crew.parent = parent;
    this.crew.isPickable = false;
    this.crewSpots = [];
    const spots = Math.min(40, Math.round(model.def.crew / 6));
    for (let i = 0; i < spots; i++) {
      const z = range(rng, -0.45, 0.42) * h.length;
      const half = Math.max(0.3, beamAt(h, z) - 0.6);
      const raised = (c.quarter > 0 && z < -h.length / 2 + h.length * c.quarter) || (c.fore > 0 && z > h.length / 2 - h.length * c.fore);
      this.crewSpots.push(Matrix.Translation(range(rng, -half, half), deckAt(h, z) + 0.85 + (raised ? CASTLE_HEIGHT : 0), z));
    }
    this.setCrew(model.def.crew, model.def.crew);
  }

  private castle(scene: Scene, parent: TransformNode, h: HullShape, z0: number, z1: number, wood: StandardMaterial, name: string, lift = 0): Mesh {
    const zm = (z0 + z1) / 2;
    const width = Math.max(beamAt(h, zm), beamAt(h, z1 - 0.5), 0.5) * 2 * (lift > 0 ? 0.9 : 0.98);
    // Sides show the gallery texture; the roof and floor take a plain strip of planking.
    const side = new Vector4(0, 0, 1, 1);
    const plank = new Vector4(0, 0.85, 0.05, 0.98);
    const box = MeshBuilder.CreateBox(`castle-${name}`, { width, height: CASTLE_HEIGHT, depth: z1 - z0, faceUV: [side, side, side, side, plank, plank] }, scene);
    box.position = new Vector3(0, deckAt(h, zm) + lift + CASTLE_HEIGHT / 2, zm);
    box.material = wood;
    box.parent = parent;
    box.receiveShadows = true;
    return box;
  }

  /** Shrouds with ratlines: rungs every 0.55 m between neighbouring shrouds (a ladder net). */
  private ratlines(scene: Scene, parent: TransformNode, model: ShipModel): void {
    const h = model.def.hull;
    const lines: Vector3[][] = [];
    for (const m of model.def.masts) {
      const topY = h.freeboard + m.height * 0.58;
      for (const side of [-1, 1]) {
        const shrouds = [-1.6, -0.55, 0.55, 1.6].map((dz) => ({ foot: new Vector3(side * (beamAt(h, m.z) + 0.35), deckAt(h, m.z) + 0.9, m.z + dz), head: new Vector3(side * 0.45, topY, m.z + dz * 0.25) }));
        for (const s of shrouds) lines.push([s.foot, s.head]);
        const rungs = Math.floor((topY - deckAt(h, m.z) - 1) / 0.55);
        for (let r = 1; r < rungs; r++) {
          const t = r / rungs;
          lines.push(shrouds.map((s) => Vector3.Lerp(s.foot, s.head, t)));
        }
      }
    }
    const mesh = MeshBuilder.CreateLineSystem("ratlines", { lines }, scene);
    mesh.color = new Color3(0.08, 0.06, 0.05);
    mesh.parent = parent;
    mesh.isPickable = false;
  }

  private rails(scene: Scene, parent: TransformNode, h: HullShape, mats: DetailMaterials, c: { quarter: number }): void {
    const post = MeshBuilder.CreateBox("rail-post", { width: 0.12, height: 0.9, depth: 0.12 }, scene);
    post.material = mats.dark;
    post.parent = parent;
    post.isPickable = false;
    const ms: Matrix[] = [];
    // Balusters along the quarterdeck edge and the waist bulwark cap.
    for (let u = 0.04; u < 0.96; u += 0.8 / h.length) {
      const z = stationZ(h, u);
      const onQuarter = c.quarter > 0 && u < c.quarter;
      const y = deckAt(h, z) + 0.45 + (onQuarter ? CASTLE_HEIGHT + 0.0 : 0.9);
      const x = Math.max(0.2, beamAt(h, z) - 0.06);
      ms.push(Matrix.Translation(-x, y, z), Matrix.Translation(x, y, z));
    }
    instances(post, ms);
  }

  private lanterns(scene: Scene, parent: TransformNode, h: HullShape, mats: DetailMaterials, lift: number): void {
    const lamp = MeshBuilder.CreateSphere("lantern", { diameter: 0.45, segments: 6 }, scene);
    lamp.material = mats.lantern;
    lamp.parent = parent;
    lamp.isPickable = false;
    const z = -h.length / 2 + 0.2;
    const y = deckAt(h, z) + lift + 1.6;
    instances(lamp, lift > 0 ? [Matrix.Translation(-0.9, y, z), Matrix.Translation(0, y + 0.4, z), Matrix.Translation(0.9, y, z)] : [Matrix.Translation(0, y, z)]);
  }

  /** Shows a share of the figures matching the crew left aboard. */
  setCrew(crew: number, max: number): void {
    const n = Math.round((this.crewSpots.length * crew) / Math.max(1, max));
    this.crew.isVisible = n > 0;
    if (n > 0) instances(this.crew, this.crewSpots.slice(0, n));
  }
}
