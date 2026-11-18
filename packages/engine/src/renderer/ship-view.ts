import { type Entity, type FactionId, type ShipModel, setFactor } from "@broadside/sim";
import { type ShipPart, partId, rotateInv, vec3, windVector } from "@broadside/core";
import { Color3, DynamicTexture, Texture, Mesh, MeshBuilder, Quaternion, type Scene, StandardMaterial, TransformNode, Vector3, VertexData, type ShadowGenerator , type LinesMesh } from "../babylon";
import { type Geometry, deckGeometry, hullGeometry } from "./hull-geometry";
import { liveryOps, paint } from "./hull-livery";
import { type DetailMaterials, ShipDetail, createDetailMaterials } from "./ship-detail";
import { type HullModels } from "./hull-models";
import { BentMast } from "./bent-mast";
import { sternCastle } from "./castle-layout";
import { type SideProfile } from "./side-profile";
import { gunPlaces } from "./gun-layout";
import { modelCrewSpots } from "./crew-layout";
import { buildModelCastle } from "./model-castle";
import { buildModelDecks, buildModelRails } from "./model-rails";
import { type RunningLine, runningRigging, shroudLadders, stayEnds } from "./rig-layout";
import { listShipParts } from "./ship-parts";
import { RopeTubes } from "./rope-tubes";
import { CrewActivityTracker } from "./crew-activity";
import { type CrewRig } from "./crew-rig";
import { type GunScan, ShipGuns, gunHeight } from "./ship-guns";
import { type MastBend, MastSprings, bendShare, sagLine } from "./rig-motion";
import { type SailPlan, rigPlan } from "./rig-plan";
import { SailCloth, type SailState } from "./sail-cloth";
import { type SailPaint, paintSail, paintSailGlow, paintSailRelief } from "./sail-texture";

/**
 * Visual of one ship, built from its class (hull lines, rig plan) and synced each frame from
 * the simulation entity. Root node = centre of mass; the hull-space node is offset by -com.
 */
const LIVERY: Readonly<Record<FactionId, readonly [number, number, number]>> = {
  player: [0.62, 0.48, 0.22],
  crown: [0.55, 0.12, 0.1],
  republic: [0.15, 0.25, 0.5],
  empire: [0.7, 0.6, 0.2],
  pirates: [0.1, 0.1, 0.1],
};


export interface ShipMaterials {
  readonly hull: StandardMaterial;
  readonly deck: StandardMaterial;
  readonly wood: StandardMaterial;
  readonly sail: StandardMaterial;
  readonly rope: StandardMaterial;
  readonly flag: Readonly<Record<FactionId, StandardMaterial>>;
  readonly detail: DetailMaterials;
  /** Side of the painted sail textures (px), by the graphics preset. */
  readonly sailSize: number;
}

const material = (scene: Scene, name: string, c: [number, number, number], spec = 0.05): StandardMaterial => {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = new Color3(...c);
  m.specularColor = new Color3(spec, spec, spec);
  return m;
};

/** A tiling texture of the Poly Haven set (tools/assets/textures.mjs). */
const tiled = (scene: Scene, url: string, u: number, v: number): Texture => {
  const t = new Texture(url, scene);
  t.uScale = u;
  t.vScale = v;
  return t;
};

/**
 * `texturesUrl`: folder of the Poly Haven textures (CC0); without it the materials stay plain
 * colours. Deck: weathered planks along the ship. Spars: dark timber. Sails: a linen weave as a
 * normal map over the painted canvas.
 */
export const createShipMaterials = (scene: Scene, texturesUrl?: string, quality: "low" | "medium" | "high" = "high"): ShipMaterials => {
  const lite = quality === "low" ? "-lite" : "";
  const hull = material(scene, "hull", [1, 1, 1], 0.08);
  hull.backFaceCulling = false;
  hull.twoSidedLighting = true;
  // A deck at sea is wet with spray: a tight sheen that throws the low sun back (ref_112).
  const deck = material(scene, "deck", [0.5, 0.42, 0.32], 0.32);
  deck.specularPower = 42;
  deck.backFaceCulling = false;
  deck.twoSidedLighting = true;
  const sail = material(scene, "sail", [0.6, 0.55, 0.46], 0.02);
  sail.backFaceCulling = false;
  sail.twoSidedLighting = true;
  const flag = Object.fromEntries(
    (Object.keys(LIVERY) as FactionId[]).map((f) => {
      const c = LIVERY[f];
      const m = material(scene, `flag-${f}`, [c[0], c[1], c[2]]);
      m.emissiveColor = new Color3(c[0] * 0.3, c[1] * 0.3, c[2] * 0.3);
      m.backFaceCulling = false;
      return [f, m];
    }),
  ) as Record<FactionId, StandardMaterial>;
  const wood = material(scene, "spar", [0.22, 0.15, 0.09]);
  const detail = createDetailMaterials(scene);
  if (texturesUrl) {
    deck.diffuseColor = new Color3(1.15, 1.05, 0.95);
    deck.diffuseTexture = tiled(scene, `${texturesUrl}weathered_planks_diff${lite}.jpg`, 3, 1);
    deck.bumpTexture = tiled(scene, `${texturesUrl}weathered_planks_nor_gl${lite}.jpg`, 3, 1);
    wood.diffuseColor = new Color3(0.9, 0.75, 0.6);
    // The grain runs along the spar (the texture's planks lie across: turned a quarter).
    wood.diffuseTexture = tiled(scene, `${texturesUrl}dark_planks_diff${lite}.jpg`, 3, 1);
    wood.bumpTexture = tiled(scene, `${texturesUrl}dark_planks_nor_gl${lite}.jpg`, 3, 1);
    for (const t of [wood.diffuseTexture, wood.bumpTexture] as Texture[]) t.wAng = Math.PI / 2;
    // Generated hulls and castles: the relief of planking over their painted colours (strakes run
    // fore and aft: the texture's planks are turned a quarter).
    hull.bumpTexture = tiled(scene, `${texturesUrl}weathered_planks_nor_gl${lite}.jpg`, 3, 8);
    (hull.bumpTexture as Texture).wAng = Math.PI / 2;
    detail.castle.bumpTexture = tiled(scene, `${texturesUrl}weathered_planks_nor_gl${lite}.jpg`, 2, 3);
    (detail.castle.bumpTexture as Texture).wAng = Math.PI / 2;
    // Sailcloth: the linen weave as a detail map (colour and normal) under the painted canvas and
    // the relief of its seams (set per painted sail in sailMaterial).
    sail.detailMap.texture = tiled(scene, `${texturesUrl}rough_linen_detail${lite}.png`, 9, 9);
    sail.detailMap.isEnabled = true;
    sail.detailMap.diffuseBlendLevel = 0.55;
    sail.detailMap.bumpLevel = 0.7;
  }
  const sailSize = quality === "low" ? 512 : quality === "medium" ? 1024 : 2048;
  return { sailSize, hull, deck, wood, sail, rope: material(scene, "rope", [0.12, 0.1, 0.08]), flag, detail };
};

/** One painted canvas per faction and emblem choice, shared (Flyweight). */
const sailMaterial = (scene: Scene, base: StandardMaterial, faction: FactionId, emblem: boolean, size: number): StandardMaterial => {
  const key = `sail-${faction}-${emblem ? "e" : "p"}`;
  const cached = scene.getMaterialByName(key);
  if (cached) return cached as StandardMaterial;
  const tex = new DynamicTexture(key, { width: size, height: size }, scene, true);
  paintSail(tex.getContext() as unknown as SailPaint, size, faction, emblem);
  tex.update(true);
  // The frayed foot is cut out of the alpha (alpha test, so shadows follow it).
  tex.hasAlpha = true;
  const m = base.clone(key) as StandardMaterial;
  m.diffuseColor = new Color3(1, 1, 1);
  m.diffuseTexture = tex;
  // The sewing stands proud of the cloth: one relief map for all sails of this size.
  const reliefKey = `sail-relief-${size}`;
  let relief = scene.getTextureByName(reliefKey) as DynamicTexture | null;
  if (!relief) {
    relief = new DynamicTexture(reliefKey, { width: size / 2, height: size / 2 }, scene, true);
    paintSailRelief(relief.getContext() as unknown as SailPaint, size / 2);
    relief.update(true);
  }
  m.bumpTexture = relief;
  if (emblem) {
    const glow = new DynamicTexture(`${key}-glow`, { width: 128, height: 128 }, scene, true);
    paintSailGlow(glow.getContext() as unknown as SailPaint, 128, faction);
    glow.update(true);
    m.emissiveTexture = glow;
  }
  return m;
};

/**
 * Night lighting of the ships: emblem sails and gallery windows glow as the daylight goes
 * (emissive scaled by darkness, so they stay invisible by day as in the reference).
 */
export const setNightGlow = (scene: Scene, darkness: number): void => {
  const k = Math.max(0, Math.min(1, darkness));
  for (const m of scene.materials) {
    // StandardMaterial adds the emissive colour everywhere and the emissive texture on top:
    // the colour stays black, the glow map's level carries the strength.
    if (!(m instanceof StandardMaterial)) continue;
    if (m.name.startsWith("sail-") || m.name.startsWith("castle")) m.emissiveColor = Color3.Black();
    // Strong enough to bloom but short of white, so the warm colour survives the toning (grade.ts).
    if (m.name.startsWith("sail-") && m.name.endsWith("-e") && m.emissiveTexture) m.emissiveTexture.level = 2.4 * k;
    // Lanterns are lit at dusk: by day the glass only catches a little light.
    if (m.name === "detail-lantern") m.emissiveColor.set(1.6 * (0.18 + 0.82 * k), 1.1 * (0.18 + 0.82 * k), 0.55 * (0.18 + 0.82 * k));
    if (m.name === "castle-glass") m.emissiveColor.set(1.1 * k, 0.72 * k, 0.32 * k);
    if ((m.name.startsWith("castle")) && m.emissiveTexture) m.emissiveTexture.level = 0.25 + 1.6 * k;
  }
};

/** Within this distance of the camera a ship's canvas is simulated as fabric (sail-sim). */
const CLOTH_SIM = 220;
/** Within this distance of the camera a ship shows the scanned gun barrels. */
const SCAN_GUNS = 140;

/** Beyond this distance a ship drops its ratlines, rails, lanterns and crew. */
const FINE_DETAIL = 320;

export class ShipView {
  readonly root: TransformNode;
  private cloth!: SailCloth;
  private plans: SailPlan[] = [];
  /** Per plan: the physics sail is fore-and-aft while this canvas is square (spritsail). */
  private fixed: boolean[] = [];
  private readonly masts: BentMast[] = [];
  private readonly flag: Mesh;
  private readonly flagPositions: Float32Array;
  private readonly detail: ShipDetail;
  private readonly guns: ShipGuns;

  /** Level of detail by distance to the camera (metres). */
  setDistance(d: number): void {
    // The animated crew replace the stand-ins the first time the ship comes close after they load.
    if (d < FINE_DETAIL && this.rig?.templates) this.detail.crew.useRig(this.rig);
    this.detail.setFine(d < FINE_DETAIL);
    this.guns.setDetail(d < FINE_DETAIL * 2, d < SCAN_GUNS);
    this.stays.tubes.mesh.setEnabled(d < FINE_DETAIL);
    this.clothNear = d < CLOTH_SIM;
    this.running.tubes.mesh.setEnabled(d < FINE_DETAIL);
  }
  private shownCrew = -1;
  private activity: CrewActivityTracker | null = null;
  /** The ship's own frame (hull space), parent of everything drawn on her. */
  private hullSpace!: TransformNode;
  private clothNear = false;
  private running!: { lines: RunningLine[]; tubes: RopeTubes };
  private springs!: MastSprings;
  private stays!: { mesh: LinesMesh; tubes: RopeTubes; ends: { from: number; a: [number, number, number]; to: number; b: [number, number, number] }[] };
  private flagMast = 0;
  private flagBase = new Vector3();
  private lastTime = 0;
  /** Every part of this ship by name and carrier (core's parts catalogue), as the view built her. */
  readonly parts: readonly ShipPart[];
  /** Whether this view shows a modelled hull (rebuilt when the model arrives after the ship). */
  readonly modelled: boolean;

  constructor(scene: Scene, readonly entityId: number, readonly model: ShipModel, faction: FactionId, mats: ShipMaterials, shadows: ShadowGenerator | null, hulls: HullModels | null = null, gunScan: GunScan | null = null, private readonly rig: CrewRig | null = null) {
    this.root = new TransformNode(`ship-${entityId}`, scene);
    this.root.rotationQuaternion = new Quaternion();
    const hullSpace = new TransformNode(`ship-${entityId}-hull`, scene);
    this.hullSpace = hullSpace;
    hullSpace.parent = this.root;
    hullSpace.position = new Vector3(-model.com.x, -model.com.y, -model.com.z);
    const hullMesh = this.buildMesh(scene, `hull-${entityId}`, hullGeometry(model.def.hull), this.liveryMaterial(scene, model, faction, mats));
    hullMesh.parent = hullSpace;
    shadows?.addShadowCaster(hullMesh);
    const deck = this.buildMesh(scene, `deck-${entityId}`, deckGeometry(model.def.hull), mats.deck);
    deck.parent = hullSpace;
    // The measured side of a modelled hull: stays, shrouds, channels and the rail are fitted to it.
    const side = hulls?.profile(model.def.id, model.def.hull) ?? null;
    this.buildRig(scene, hullSpace, model, faction, mats, shadows, side);
    this.detail = new ShipDetail(scene, hullSpace, `${model.def.id}-${entityId}`, model, mats.detail, shadows, side);
    if (side) {
      buildModelRails(scene, hullSpace, side, mats.wood, shadows);
      buildModelDecks(scene, hullSpace, side, mats.deck);
      // The high sterncastle of the reference ship, raised where the model ends in an open quarterdeck.
      const places = gunPlaces(model, (_, z) => side.halfAt(z));
      const castle = sternCastle(side, places);
      this.detail.crew.setSpots(modelCrewSpots(model, { side, castle, guns: places, tops: rigPlan(model.def).tops, ladders: shroudLadders(model, side) }));
      if (castle) buildModelCastle(scene, hullSpace, castle, { castle: mats.detail.castle, deck: mats.deck, wood: mats.wood, lantern: mats.detail.lantern }, shadows, hulls?.planks(model.def.id, model.def.hull) ?? null, model.def.id);
    }
    // A modelled hull replaces the generated one, its deck and the procedural castles and fittings.
    const hullMeshes = hulls?.instantiate(model.def.id, hullSpace, model.def.hull) ?? null;
    this.modelled = hullMeshes !== null;
    // Guns stand at the side the hull really has: the model's, where there is one.
    const sides = hullMeshes && hulls
      ? hulls.sides(model.def.id, hullMeshes, hullSpace, model.guns.map((g) => ({ y: g.pos.y + model.com.y + gunHeight(g.kind), z: g.pos.z + model.com.z, sign: Math.sign(g.dir.x) || 1 })), model.def.hull.beam)
      : null;
    this.guns = new ShipGuns(scene, hullSpace, model, mats.detail.dark, mats.wood, shadows, gunScan, sides);
    if (this.modelled) {
      hullMesh.setEnabled(false);
      deck.setEnabled(false);
      this.detail.hideBody();
    }
    const plan = rigPlan(model.def);
    this.parts = listShipParts(model, plan, side);
    const tallest = plan.mastTops.reduce((a, b) => (b.y > a.y ? b : a));
    const flag = this.buildFlag(scene, mats.flag[faction]);
    flag.mesh.parent = hullSpace;
    flag.mesh.position = new Vector3(0, tallest.y + 0.2, tallest.z);
    this.flagBase = flag.mesh.position.clone();
    this.flagMast = plan.mastTops.indexOf(tallest);
    this.flag = flag.mesh;
    this.flagPositions = flag.positions;
  }

  private buildMesh(scene: Scene, name: string, g: Geometry, mat: StandardMaterial): Mesh {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = g.positions;
    data.indices = g.indices;
    data.uvs = g.uvs;
    const normals: number[] = [];
    VertexData.ComputeNormals(g.positions, g.indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = mat;
    mesh.receiveShadows = true;
    return mesh;
  }

  private liveryMaterial(scene: Scene, model: ShipModel, faction: FactionId, mats: ShipMaterials): StandardMaterial {
    const key = `livery-${model.def.id}-${faction}`;
    const cached = scene.getMaterialByName(key);
    if (cached) return cached as StandardMaterial;
    const tex = new DynamicTexture(key, { width: 1024, height: 256 }, scene, true);
    const gunZ = model.guns.filter((g) => g.kind === "broadside" && g.side === "starboard").map((g) => g.pos.z + model.com.z);
    paint(tex.getContext(), liveryOps({ hull: model.def.hull, gunDeck: model.def.guns.find((g) => g.kind === "broadside")?.deckHeight ?? 1.4, gunZ, stripe: LIVERY[faction], seed: key }), 1024, 256);
    tex.update(true);
    const m = mats.hull.clone(key) as StandardMaterial;
    m.diffuseTexture = tex;
    return m;
  }

  private buildRig(scene: Scene, parent: TransformNode, model: ShipModel, faction: FactionId, mats: ShipMaterials, shadows: ShadowGenerator | null, side: SideProfile | null): void {
    const plan = rigPlan(model.def);
    // Masts: one merged mesh per mast (so a fallen mast can be hidden), bowsprit and tops with the first.
    const parts: Mesh[][] = model.def.masts.map(() => []);
    plan.spars.forEach((sp, i) => {
      const from = new Vector3(sp.x0, sp.y0, sp.z0);
      const to = new Vector3(sp.x1, sp.y1, sp.z1);
      const m = MeshBuilder.CreateCylinder(`spar-${this.entityId}-${i}`, { height: Vector3.Distance(from, to), diameterBottom: sp.diameter, diameterTop: sp.diameter * 0.75, tessellation: 8, subdivisions: Math.max(1, Math.ceil(Vector3.Distance(from, to) / 1.5)) }, scene);
      m.position = from.add(to).scale(0.5);
      m.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), to.subtract(from).normalize(), new Quaternion());
      const mi = model.def.masts.findIndex((ms) => sp.x0 === sp.x1 && Math.abs(ms.z - sp.z0) < 1e-6 && sp.z0 === sp.z1);
      parts[Math.max(0, mi)]!.push(m);
    });
    plan.tops.forEach((t, i) => {
      const top = MeshBuilder.CreateCylinder(`top-${this.entityId}-${i}`, { height: 0.35, diameter: t.diameter, tessellation: 12 }, scene);
      top.position = new Vector3(0, t.y, t.z);
      const mi = model.def.masts.findIndex((ms) => Math.abs(ms.z - t.z) < 1e-6);
      parts[Math.max(0, mi)]!.push(top);
    });
    // Crow's nest: a lookout's barrel on the topgallant mast of the tallest mast, above its highest top.
    const main = model.def.masts.reduce((best, m, i) => (m.height > model.def.masts[best]!.height ? i : best), 0);
    const mainTops = plan.tops.filter((t) => Math.abs(t.z - model.def.masts[main]!.z) < 1e-6);
    if (mainTops.length > 1 && model.def.masts[main]!.height > 25) {
      const high = mainTops.reduce((a, b) => (b.y > a.y ? b : a));
      const nest = MeshBuilder.CreateCylinder(`nest-${this.entityId}`, { height: 1.3, diameterTop: 1.25, diameterBottom: 1.05, tessellation: 12, cap: 1 }, scene);
      nest.position = new Vector3(0, high.y + 3.2, high.z);
      parts[main]!.push(nest);
    }
    parts.forEach((list, i) => {
      const merged = Mesh.MergeMeshes(list, true, true)!;
      merged.name = `mast-${this.entityId}-${i}`;
      merged.metadata = { part: partId("mast", i) };
      merged.material = mats.wood;
      merged.parent = parent;
      shadows?.addShadowCaster(merged);
      // The mast bows along its length under load (bent-mast).
      this.masts.push(new BentMast(merged));
    });
    this.plans = [...plan.sails];
    this.fixed = this.plans.map((p) => p.shape === "square" && model.def.masts[p.mast]!.sails[p.sail]!.rig === "foreAft");
    this.cloth = new SailCloth(scene, parent, `ship-${this.entityId}`, this.plans, (p) => sailMaterial(scene, mats.sail, faction, p.emblem, mats.sailSize), mats.wood, shadows);
    this.springs = new MastSprings(plan.mastTops.map((t, i) => ({ base: t.y - model.def.masts[i]!.height, height: model.def.masts[i]!.height })));
    this.buildStays(scene, parent, plan.mastTops, plan.bowspritEnd, model, side);
    // Sheets and braces: thin laid rope from the sails' corners (close ships only).
    const lines = runningRigging(plan, model.def.hull);
    this.running = { lines, tubes: new RopeTubes(scene, parent, `running-ropes-${this.entityId}`, lines.length, 6, 0.02) };
  }

  /** Fore-and-aft stays between mast heads and to the bowsprit, and backstays to the rail. */
  private buildStays(scene: Scene, parent: TransformNode, tops: readonly { y: number; z: number }[], bow: { y: number; z: number }, model: ShipModel, side: SideProfile | null): void {
    const ends = stayEnds(tops, bow, model.def.hull, side);
    const lines = ends.map((e) => sagLine(e.a, e.b, 0).map((p) => new Vector3(...p)));
    const rig = MeshBuilder.CreateLineSystem(`stays-${this.entityId}`, { lines, updatable: true }, scene);
    rig.color = new Color3(0.08, 0.06, 0.05);
    rig.parent = parent;
    rig.isPickable = false;
    // Thick, laid rope close by; the line system carries the stays at a distance.
    const tubes = new RopeTubes(scene, parent, `stay-ropes-${this.entityId}`, ends.length, 7, 0.045);
    this.stays = { mesh: rig, tubes, ends };
  }

  /** Stays follow the mastheads and sag when the masts carry little (slack) or straighten under load. */
  private updateStays(bends: readonly MastBend[], loads: readonly number[]): void {
    const at = (mast: number, p: [number, number, number]): [number, number, number] => {
      const bend = bends[mast];
      if (mast < 0 || !bend) return p;
      const k = bendShare(bend, p[1]);
      return [p[0] + bend.dx * k, p[1], p[2] + bend.dz * k];
    };
    const paths = this.stays.ends.map((e) => {
      const a = at(e.from, e.a);
      const b = at(e.to, e.b);
      const span = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const slack = 1 - Math.min(1, loads[e.from] ?? 0);
      return sagLine(a, b, span * (0.004 + 0.022 * slack));
    });
    const lines = paths.map((path) => path.map((p) => new Vector3(...p)));
    this.stays.tubes.update(paths);
    MeshBuilder.CreateLineSystem(this.stays.mesh.name, { lines, instance: this.stays.mesh });
  }

  /** A gun fired at a world position: the nearest one recoils. */
  gunFired(at: { readonly x: number; readonly y: number; readonly z: number }): void {
    const local = Vector3.TransformCoordinates(new Vector3(at.x, at.y, at.z), this.root.computeWorldMatrix(true).clone().invert());
    this.activity?.fired(this.guns.fired(local.x + this.model.com.x, local.y + this.model.com.y, local.z + this.model.com.z));
  }

  /**
   * Sheets and braces follow the corners of the sails they belong to; a line sags when its sail
   * hardly draws and comes taut as the sail fills. A sail that is not spread draws its lines in.
   */
  private updateRunning(fill: (plan: number) => number): void {
    const paths = this.running.lines.map((l) => {
      const a = this.cloth.corner(l.from.plan, l.from.row, l.from.col);
      const end = "plan" in l.to ? this.cloth.corner(l.to.plan, l.to.row, l.to.col) : null;
      // A hull point lies on the side its corner is on now (yards are braced round).
      const b: [number, number, number] | null = "plan" in l.to ? end : [(a && a[0] < 0 ? -1 : 1) * l.to.aside, l.to.y, l.to.z];
      if (!a || !b) return sagLine(b ?? a ?? [0, 0, 0], b ?? a ?? [0, 0, 0], 0, 5);
      const span = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      return sagLine(a, b, span * (0.006 + 0.05 * (1 - Math.min(1, fill(l.from.plan)))), 5);
    });
    this.running.tubes.update(paths);
  }

  private buildFlag(scene: Scene, mat: StandardMaterial): { mesh: Mesh; positions: Float32Array } {
    const cols = 6;
    const positions = new Float32Array((cols + 1) * 2 * 3);
    const indices: number[] = [];
    for (let c = 0; c < cols; c++) indices.push(c, c + cols + 1, c + 1, c + 1, c + cols + 1, c + cols + 2);
    const mesh = new Mesh(`flag-${this.entityId}`, scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.applyToMesh(mesh, true);
    mesh.material = mat;
    return { mesh, positions };
  }

  sync(e: Entity, windDirection: number, windSpeed: number, time: number): void {
    const b = e.body!;
    const s = e.ship!;
    this.root.position.set(b.pos.x, b.pos.y, b.pos.z);
    this.root.rotationQuaternion!.set(b.rot.x, b.rot.y, b.rot.z, b.rot.w);
    const tw = windVector(windDirection, windSpeed);
    const aw = rotateInv(b.rot, vec3(tw.x - b.vel.x, 0, tw.z - b.vel.z));
    const states: SailState[] = this.plans.map((p, i) => {
      const chord = s.sailChord[p.mast]![p.sail]!;
      // A jib pivots on its stay: only its clew swings, so it turns about half the trim.
      const angle = this.fixed[i] ? Math.PI / 2 : p.shape === "jib" ? chord * 0.5 : chord;
      const lee = Math.sign(aw.x * Math.cos(angle) - aw.z * Math.sin(angle)) || 1;
      const alive = s.mastHp[p.mast]! > 0;
      const share = alive ? s.sailSet[p.mast]! / setFactor(3, false) : 0;
      const set = Math.max(0, Math.min(1, (share - p.setFrom) / p.setSpan));
      const fill = Math.min(1.4, s.sailFill[p.mast]![p.sail]!);
      // Luffing when the canvas is set but starved of wind; a strong breeze flutters every leech.
      const flutter = set > 0.05 ? Math.min(1, Math.max(0, 1 - fill / 0.35) + Math.max(0, windSpeed - 9) * 0.02) : 0;
      return { angle, set, billow: lee * (0.3 + 0.8 * fill), visible: alive && set > 0.03, flutter, furled: alive ? 1 - set : 0 };
    });
    const dt = Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    const awLen = Math.hypot(aw.x, aw.z) || 1;
    const bends = this.springs.update(dt, s.mastLoad, aw.x / awLen, 0.6);
    this.detail.ratlines.update(bends, s.mastLoad, aw.x / awLen);
    this.guns.update(dt);
    this.cloth.setDamage(s.sailCloth);
    this.cloth.update(states, bends, time, this.clothNear ? { dt, wind: awLen } : null);
    this.updateRunning((plan) => s.sailFill[this.plans[plan]!.mast]![this.plans[plan]!.sail]!);
    this.masts.forEach((m, i) => {
      m.mesh.setEnabled(s.mastHp[i]! > 0);
      const bend = bends[i];
      if (bend) m.apply(bend);
    });
    this.updateStays(bends, s.mastLoad);
    const fb = bends[this.flagMast];
    if (fb) this.flag.position.set(this.flagBase.x + fb.dx, this.flagBase.y, this.flagBase.z + fb.dz);
    if (s.crew !== this.shownCrew) {
      this.shownCrew = s.crew;
      this.detail.crew.setCrew(s.crew, s.model.def.crew);
    }
    // What the men are doing comes from what the ship is doing.
    this.activity ??= new CrewActivityTracker(s);
    this.detail.crew.animate(this.activity.update(s, time), time);
    this.updateFlag(aw.x, aw.z, time);
  }

  private updateFlag(awx: number, awz: number, time: number): void {
    const cols = this.flagPositions.length / 6 - 1;
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
