import { type ShipModel } from "@broadside/sim";
import { type AssetContainer, LoadAssetContainerAsync, Matrix, Mesh, MeshBuilder, Quaternion, type Scene, type ShadowGenerator, type StandardMaterial, type TransformNode, Vector3 } from "../babylon";
import { GLB, assetUrl } from "./asset-url";
import { useStandardMaterials } from "./model-materials";
import { gunPlaces } from "./gun-layout";
import { RECOIL_TIME, recoilShare } from "./gun-recoil";
import barrel from "./barrel-profile.json";

/**
 * The guns of a ship, at the mounts the simulation fires from (Flyweight: one barrel mesh and one
 * carriage mesh per ship, thin instances per gun). The barrel is a surface of revolution lathed from
 * the profile of the owner's scan of an 18th century swivel gun (tools/assets/lathe-profile.mjs,
 * Queen Anne NK47-11), scaled to the calibre; carriages are plain truck carriages. A gun that fires
 * recoils inboard and is run out again (gun-recoil).
 *
 * Level of detail: close to the camera the barrels are the scan itself, with its own textures
 * (GunScan, about 12 thousand triangles a gun); the lathed barrel serves at a distance and until
 * the scan has loaded.
 */
/** The scanned gun, loaded once and shared by all ships (Prototype). */
export class GunScan {
  container: AssetContainer | null = null;

  constructor(scene: Scene, url: string) {
    LoadAssetContainerAsync(assetUrl(url), scene, GLB).then(
      (c) => {
        useStandardMaterials(c, scene, "gun", 1.3);
        // The meshes are used without the loader's handedness root: draw both faces.
        for (const m of c.materials) m.backFaceCulling = false;
        this.container = c;
      },
      () => undefined,
    );
  }
}

/** The scan's length includes the tiller behind the cascabel: the barrel is this share of it, at the muzzle end. */
const SCAN_BARREL = 0.82;
interface Gun {
  /** Hull-space position of the middle of the barrel run out, and unit direction of the muzzle. */
  readonly at: Vector3;
  readonly dir: Vector3;
  readonly length: number;
  readonly thick: number;
  readonly carriage: boolean;
  /** Seconds since it fired (beyond RECOIL_TIME: at rest). */
  since: number;
}

/** The recoil travel (m). */
const TRAVEL = 1.1;

export class ShipGuns {
  private readonly guns: Gun[] = [];
  private readonly barrels: Mesh;
  private readonly carriages: Mesh;
  private readonly barrelBuf: Float32Array;
  private readonly carriageBuf: Float32Array;
  private moving = true;
  /** Copies of the scan's meshes with the transform their node carried (the file's quantisation). */
  private scanMeshes: { mesh: Mesh; local: Matrix; buf: Float32Array }[] = [];
  private near = false;
  private shown = true;

  constructor(scene: Scene, private readonly parent: TransformNode, private readonly model: ShipModel, metal: StandardMaterial, wood: StandardMaterial, shadows: ShadowGenerator | null, private readonly scan: GunScan | null = null, sides: readonly (number | null)[] | null = null) {
    const places = gunPlaces(model, sides ? (gi) => sides[gi] ?? null : null);
    model.guns.forEach((m, gi) => {
      const place = places[gi]!;
      this.guns.push({ at: new Vector3(...place.at), dir: new Vector3(...place.dir), length: place.length, thick: m.kind === "mortar" ? 2.6 : 1, carriage: m.kind !== "swivel", since: RECOIL_TIME });
    });
    // Lathe about Y: the profile's z runs along the barrel, centred on its middle.
    const shape = [new Vector3(0, -0.5, 0), ...barrel.profile.map(([z, r]) => new Vector3(r!, z! - 0.5, 0)), new Vector3(0.022, 0.5, 0)];
    this.barrels = MeshBuilder.CreateLathe(`guns-${parent.name}`, { shape, tessellation: 10, closed: true }, scene);
    this.barrels.material = metal;
    this.carriages = MeshBuilder.CreateBox(`carriages-${parent.name}`, { width: 1, height: 1, depth: 1 }, scene);
    this.carriages.material = wood;
    for (const m of [this.barrels, this.carriages]) {
      m.parent = parent;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      shadows?.addShadowCaster(m);
    }
    this.barrelBuf = new Float32Array(this.guns.length * 16);
    this.carriageBuf = new Float32Array(this.guns.filter((g) => g.carriage).length * 16);
    this.update(0);
  }

  /** The gun nearest a hull-space point has fired; returns its index (-1: none near). */
  fired(x: number, y: number, z: number): number {
    let best = -1;
    let bestD = 9;
    this.guns.forEach((g, i) => {
      const d = (g.at.x - x) ** 2 + (g.at.y - y) ** 2 + (g.at.z - z) ** 2;
      if (d < bestD && g.since >= RECOIL_TIME) {
        best = i;
        bestD = d;
      }
    });
    if (best < 0) return -1;
    this.guns[best]!.since = 0;
    this.moving = true;
    return best;
  }

  /** `shown`: guns drawn at all; `near`: close enough for the scanned barrels. */
  setDetail(shown: boolean, near: boolean): void {
    if (near && this.scanMeshes.length === 0 && this.scan?.container) {
      // Copies of the scan's meshes for this ship, one thin instance per gun.
      this.scanMeshes = this.scan.container.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0).map((m) => {
        const copy = m.clone(`${m.name}-${this.parent.name}`, this.parent);
        copy.isPickable = false;
        copy.alwaysSelectAsActiveMesh = true;
        // A thin instance is placed before its mesh's own transform: fold that into the instances.
        const local = Matrix.Compose(copy.scaling, copy.rotationQuaternion ?? Quaternion.Identity(), copy.position);
        copy.scaling.setAll(1);
        copy.position.setAll(0);
        copy.rotationQuaternion = Quaternion.Identity();
        return { mesh: copy, local, buf: new Float32Array(this.guns.length * 16) };
      });
      this.moving = true;
    }
    if (near !== this.near) this.moving = true;
    this.near = near;
    this.shown = shown;
    const scanned = near && this.scanMeshes.length > 0;
    this.barrels.setEnabled(shown && !scanned);
    this.carriages.setEnabled(shown);
    for (const m of this.scanMeshes) m.mesh.setEnabled(shown && scanned);
  }

  update(dt: number): void {
    if (!this.moving) return;
    this.moving = false;
    const up = Vector3.Up();
    let c = 0;
    this.guns.forEach((g, i) => {
      g.since = Math.min(RECOIL_TIME, g.since + dt);
      if (g.since < RECOIL_TIME) this.moving = true;
      const back = g.carriage && g.thick === 1 ? recoilShare(g.since) * TRAVEL : 0;
      const pos = g.at.subtract(g.dir.scale(back));
      // Local Y along the barrel, X across, Z the carriage's height.
      const across = Vector3.Cross(up, g.dir).normalize();
      const rot = Quaternion.RotationQuaternionFromAxis(across, g.dir, Vector3.Cross(across, g.dir));
      Matrix.Compose(new Vector3(g.length * g.thick, g.length, g.length * g.thick), rot, pos).copyToArray(this.barrelBuf, i * 16);
      if (this.scanMeshes.length > 0) {
        // The scan lies along its local Z, its barrel in the muzzle-end share of its length.
        const k = g.length / SCAN_BARREL;
        const turn = Quaternion.RotationQuaternionFromAxis(across, Vector3.Cross(g.dir, across), g.dir);
        const mid = pos.subtract(g.dir.scale(k * (1 - SCAN_BARREL) * 0.5));
        const place = Matrix.Compose(new Vector3(k * g.thick, k * g.thick, k), turn, mid);
        for (const m of this.scanMeshes) m.local.multiply(place).copyToArray(m.buf, i * 16);
      }
      if (!g.carriage) return;
      // Truck carriage under the breech half of the barrel: as wide as two barrels, low.
      const w = g.length * 0.26 * g.thick;
      const seat = pos.subtract(g.dir.scale(g.length * 0.18)).subtract(up.scale(g.length * 0.1 + 0.12));
      Matrix.Compose(new Vector3(w, g.length * 0.6, 0.3), rot, seat).copyToArray(this.carriageBuf, c++ * 16);
    });
    this.barrels.thinInstanceSetBuffer("matrix", this.barrelBuf, 16, false);
    if (this.carriageBuf.length) this.carriages.thinInstanceSetBuffer("matrix", this.carriageBuf, 16, false);
    for (const m of this.scanMeshes) m.mesh.thinInstanceSetBuffer("matrix", m.buf, 16, false);
  }
}

export { gunHeight } from "./gun-layout";
