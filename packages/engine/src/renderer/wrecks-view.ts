import { type WreckSite } from "@broadside/core";
import { LoadAssetContainerAsync, type Scene, TransformNode } from "../babylon";
import { useStandardMaterials } from "./model-materials";

/**
 * Wrecks on the shoals (Prototype, GoF: one loaded model per wreck, instanced per site). The models
 * are the owner's scans of the Uelvesbüll and Älvsnabben wrecks at the full mesh of the scans,
 * turned upright and scaled to unit length by tools/assets/upright.mjs; each site sets its length,
 * heading and heel, and buries the keel in the sand. Scenery only: the shoal itself grounds a ship
 * that comes this close.
 */
/** Share of the wreck's height sunk in the seabed. */
const BURIED = 0.08;
/** Files and their height as a share of the length (from the tool's report). */
const MODELS = [
  { file: "wreck.glb", height: 0.173 },
  { file: "wreck2.glb", height: 0.212 },
] as const;

export class WrecksView {
  constructor(private readonly scene: Scene, private readonly url: string) {}

  /** Loads the models in use and sets a copy on every site; a missing file leaves its sites empty. */
  async place(sites: readonly WreckSite[]): Promise<void> {
    await Promise.all(
      MODELS.map(async (m, k) => {
        const mine = sites.filter((s) => s.variant % MODELS.length === k);
        if (mine.length === 0) return;
        try {
          const container = await LoadAssetContainerAsync(`${this.url}${m.file}`, this.scene);
          useStandardMaterials(container, this.scene, `wreck${k}`);
          mine.forEach((s, i) => {
            const at = new TransformNode(`wreck${k}-${i}`, this.scene);
            at.position.set(s.x, s.seabed - s.length * m.height * BURIED, s.z);
            at.rotation.set(0, s.heading, s.heel);
            at.scaling.setAll(s.length);
            const inst = container.instantiateModelsToScene((n) => `${n}-wreck${k}-${i}`, false);
            for (const root of inst.rootNodes) root.parent = at;
          });
        } catch {
          // No model (offline build): no wreck of this kind.
        }
      }),
    );
  }
}
