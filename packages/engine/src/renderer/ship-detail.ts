import { type ShipModel } from "@broadside/sim";
import { type HullShape, createRng, hashString, range, stationZ } from "@broadside/core";
import { beamAt, deckAt } from "./hull-stations";
import { type CrewSpot } from "./crew-layout";
import { Ratlines } from "./ratlines";
import { type SideProfile } from "./side-profile";
import { Color3, DynamicTexture, Matrix, Mesh, Quaternion, Vector4, MeshBuilder, type Scene, StandardMaterial, type TransformNode, Vector3, type ShadowGenerator } from "../babylon";

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

const CASTLE_HEIGHT = 2.8;

/**
 * A standing man as one small mesh, his origin at his feet: a body (capsule) and a head (sphere),
 * enough for the silhouettes on the rail the reference shows against the sky.
 */
const figure = (scene: Scene, name: string): Mesh => {
  const body = MeshBuilder.CreateCapsule(`${name}-body`, { height: 1.42, radius: 0.22, tessellation: 6, subdivisions: 1 }, scene);
  body.position.y = 0.71;
  const head = MeshBuilder.CreateSphere(`${name}-head`, { diameter: 0.26, segments: 4 }, scene);
  head.position.y = 1.58;
  const man = Mesh.MergeMeshes([body, head], true, true)!;
  man.name = name;
  return man;
};

const instances = (mesh: Mesh, matrices: Matrix[]): void => {
  const buf = new Float32Array(matrices.length * 16);
  matrices.forEach((m, i) => buf.set(m.m, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
};


export class ShipDetail {
  private readonly crew: Mesh;
  /** Shrouds and ratlines, moving with the masts (ship-view drives them). */
  readonly ratlines: Ratlines;
  private readonly crewSpots: Matrix[];
  /** Small parts hidden at a distance (ratlines, rails, lanterns, crew): level of detail. */
  private readonly fine: ReturnType<TransformNode["getChildMeshes"]> = [];
  private fineShown = true;
  /** Parts a modelled hull brings itself (castles, rails, lanterns, crew stand-ins): hidden then. */
  private readonly body: ReturnType<TransformNode["getChildMeshes"]> = [];
  private bodyHidden = false;
  private crewShown = 1;
  /** Copies of the crew figures, when they have loaded (useFigures). */
  private readonly figures: Mesh[] = [];
  private crewMax = 1;

  constructor(scene: Scene, parent: TransformNode, key: string, model: ShipModel, mats: DetailMaterials, shadows: ShadowGenerator | null, side: SideProfile | null = null) {
    const h = model.def.hull;
    const rng = createRng(hashString(key));
    const c = castles(model.def.id);
    const castleMeshes: Mesh[] = [];
    if (c.quarter > 0) castleMeshes.push(this.castle(scene, parent, h, -h.length / 2, -h.length / 2 + h.length * c.quarter, mats.castle, "quarter"));
    if (c.poop > 0) castleMeshes.push(this.castle(scene, parent, h, -h.length / 2, -h.length / 2 + h.length * c.poop, mats.castle, "poop", CASTLE_HEIGHT));
    if (c.fore > 0) castleMeshes.push(this.castle(scene, parent, h, h.length / 2 - h.length * c.fore, h.length * 0.47, mats.castle, "fore"));
    for (const m of castleMeshes) shadows?.addShadowCaster(m);
    this.body.push(...castleMeshes);
    const before = new Set(parent.getChildMeshes(true));
    this.ratlines = new Ratlines(scene, parent, model, side, mats.dark);
    const afterRatlines = new Set(parent.getChildMeshes(true));
    this.rails(scene, parent, h, mats, c);
    this.lanterns(scene, parent, h, mats, c.quarter > 0 ? CASTLE_HEIGHT : 0);
    this.crew = figure(scene, `crew-${key}`);
    this.crew.material = mats.crew;
    this.crew.parent = parent;
    this.crew.isPickable = false;
    this.crewSpots = [];
    const spots = Math.min(40, Math.round(model.def.crew / 6));
    for (let i = 0; i < spots; i++) {
      const z = range(rng, -0.45, 0.42) * h.length;
      const half = Math.max(0.3, beamAt(h, z) - 0.6);
      const raised = (c.quarter > 0 && z < -h.length / 2 + h.length * c.quarter) || (c.fore > 0 && z > h.length / 2 - h.length * c.fore);
      this.crewSpots.push(Matrix.Translation(range(rng, -half, half), deckAt(h, z) + (raised ? CASTLE_HEIGHT : 0), z));
    }
    this.fine.push(...parent.getChildMeshes(true).filter((m) => !before.has(m)));
    // The crew stay aboard a modelled hull too: only their stand on the deck changes (setSpots).
    this.body.push(...parent.getChildMeshes(true).filter((m) => !afterRatlines.has(m) && m !== this.crew));
    this.setCrew(model.def.crew, model.def.crew);
  }

  /** Shows or hides the small parts (far ships lose them: a few draw calls each). */
  /** A modelled hull carries its own castles, rails and fittings: hide the procedural ones. */
  hideBody(): void {
    this.bodyHidden = true;
    for (const m of this.body) m.setEnabled(false);
  }

  setFine(shown: boolean): void {
    if (shown === this.fineShown) return;
    this.fineShown = shown;
    for (const m of this.fine) m.setEnabled(shown && !(this.bodyHidden && this.body.includes(m)));
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

  /**
   * Draws the men with the crew figures (CrewFigures) instead of the plain ones: a copy of each
   * figure for this ship, the spots dealt round them in turn.
   */
  useFigures(templates: readonly Mesh[], parent: TransformNode): void {
    if (this.figures.length > 0 || templates.length === 0) return;
    for (const t of templates) {
      const copy = t.clone(`${t.name}-${parent.name}`, parent);
      copy.isPickable = false;
      copy.alwaysSelectAsActiveMesh = true;
      copy.setEnabled(this.fineShown);
      this.figures.push(copy);
      this.fine.push(copy);
    }
    this.crew.setEnabled(false);
    this.fine.splice(this.fine.indexOf(this.crew), 1);
    this.setCrew(this.crewShown, this.crewMax);
  }

  /** Puts the figures where a modelled hull's decks are (crew-layout), and keeps the last crew count. */
  setSpots(spots: readonly CrewSpot[]): void {
    this.crewSpots.length = 0;
    for (const s of spots) this.crewSpots.push(Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(s.yaw, 0, 0), new Vector3(...s.at)));
    this.setCrew(this.crewShown, this.crewMax);
  }

  /** Shows a share of the figures matching the crew left aboard. */
  setCrew(crew: number, max: number): void {
    this.crewShown = crew;
    this.crewMax = max;
    const n = Math.round((this.crewSpots.length * crew) / Math.max(1, max));
    if (this.figures.length > 0) {
      this.figures.forEach((f, k) => {
        const mine = this.crewSpots.slice(0, n).filter((_, i) => i % this.figures.length === k);
        f.isVisible = mine.length > 0;
        if (mine.length > 0) instances(f, mine);
      });
      return;
    }
    this.crew.isVisible = n > 0;
    if (n > 0) instances(this.crew, this.crewSpots.slice(0, n));
  }
}
