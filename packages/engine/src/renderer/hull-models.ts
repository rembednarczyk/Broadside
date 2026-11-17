import { type ShipClassId } from "@broadside/core";
import { type AbstractMesh, type AssetContainer, Ray, type Scene, type TransformNode, LoadAssetContainerAsync, Vector3 } from "../babylon";
import { GLB, assetUrl } from "./asset-url";
import { useStandardMaterials } from "./model-materials";

/**
 * Modelled hulls (Prototype, GoF: one loaded container per class, instanced per ship). The GLBs come
 * from tools/assets (museum and art models of the owner's collection, cut below the masts, keel at
 * y = 0, bow along +Z). A hull is scaled uniformly to the beam of the class's physics hull and set
 * with its keel at the draft; masts, sails and rigging stay procedural (they move with the wind).
 * The model's measures come from its JSON sidecar. Loaded PBR materials become StandardMaterials with the same colour texture, like the rest of the
 * scene (no image-based lighting, see decyzje 16.11).
 */
/** Measures of a cut hull written by tools/assets/hull-cut.mjs beside the GLB (model units). */
interface HullMetrics {
  readonly beam: number;
  readonly length: number;
  readonly gunwale: number;
  /** Brightness of the model's colour texture (default HULL_GAIN): scans and art models differ widely. */
  readonly gain?: number;
}

/** Brightness of the hull textures: the models' timber is far darker than the generated hulls. */
const HULL_GAIN = 1.6;

/** Height of the bulwark above the deck the physics hull is built to (m). */
const BULWARK = 0.8;

export class HullModels {
  private readonly sideCache = new Map<ShipClassId, (number | null)[]>();
  private readonly loaded = new Map<ShipClassId, { container: AssetContainer; metrics: HullMetrics }>();

  /** `tier`: "" for the full models (high and above), "-lite" for the low preset only. */
  constructor(private readonly scene: Scene, private readonly baseUrl: string, private readonly tier: "" | "-lite" = "") {}

  /** Loads the classes that have a model; failures leave the procedural hull in place. */
  async load(classes: readonly ShipClassId[]): Promise<void> {
    await Promise.all(
      classes.map(async (id) => {
        try {
          const [container, metrics] = await Promise.all([
            LoadAssetContainerAsync(assetUrl(`${this.baseUrl}${id}${this.tier}.glb`), this.scene, GLB),
            fetch(`${this.baseUrl}${id}.json`).then((res) => res.json() as Promise<HullMetrics>),
          ]);
          useStandardMaterials(container, this.scene, `hull-${id}`, metrics.gain ?? HULL_GAIN);
          this.loaded.set(id, { container, metrics });
        } catch {
          // No model for this class (or offline): the ship keeps its generated hull.
        }
      }),
    );
  }

  has(id: ShipClassId): boolean {
    return this.loaded.has(id);
  }

  /**
   * A copy of the class's hull under `parent`, fitted to the physics hull: the beam to its beam, the
   * gunwale amidships to its deck plus a bulwark (models are often longer and flatter than the
   * stubby physics hulls), the length in proportion to the beam. Returns its meshes, or null without a model.
   */
  instantiate(id: ShipClassId, parent: TransformNode, hull: { beam: number; draft: number; freeboard: number }): AbstractMesh[] | null {
    const m = this.loaded.get(id);
    if (!m) return null;
    const inst = m.container.instantiateModelsToScene((n) => `${n}-${parent.name}`, false, { doNotInstantiate: true });
    const kx = hull.beam / m.metrics.beam;
    const ky = (hull.draft + hull.freeboard + BULWARK) / m.metrics.gunwale;
    const meshes: AbstractMesh[] = [];
    for (const root of inst.rootNodes) {
      root.parent = parent;
      const node = root as TransformNode;
      node.scaling = node.scaling.multiplyByFloats(kx, ky, kx);
      node.position = new Vector3(0, -hull.draft, 0);
      meshes.push(...node.getChildMeshes(false));
    }
    return meshes;
  }

  /**
   * Where the model's side really is: half-breadths at points (y, z) of hull space on the side
   * `sign`, found by casting a ray inboard at the instantiated meshes (ray casting against the
   * mesh, once per class and cached: every ship of a class has the same hull). `parent` must
   * still stand at the origin, as a new ship's hull node does.
   */
  sides(id: ShipClassId, meshes: readonly AbstractMesh[], parent: TransformNode, points: readonly { y: number; z: number; sign: number }[], reach: number): (number | null)[] {
    const cached = this.sideCache.get(id);
    if (cached) return cached;
    parent.computeWorldMatrix(true);
    for (const m of meshes) m.computeWorldMatrix(true);
    const off = parent.getAbsolutePosition();
    const out = points.map((p) => {
      const ray = new Ray(new Vector3(off.x + p.sign * reach, off.y + p.y, off.z + p.z), new Vector3(-p.sign, 0, 0), reach);
      let best: number | null = null;
      for (const m of meshes) {
        const hit = ray.intersectsMesh(m, false);
        if (hit.hit && hit.pickedPoint) best = Math.max(best ?? 0, Math.abs(hit.pickedPoint.x - off.x));
      }
      return best;
    });
    this.sideCache.set(id, out);
    return out;
  }
}
