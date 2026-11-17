import { type WreckSite } from "@broadside/core";
import { LoadAssetContainerAsync, type Scene, TransformNode } from "../babylon";
import { useStandardMaterials } from "./model-materials";

/**
 * Wrecks on the shoals (Prototype, GoF: one loaded model, instanced per site). The model is the
 * owner's scan of the Uelvesbüll wreck, turned upright and scaled to unit length by
 * tools/assets/wreck.mjs; each site sets its length, heading and heel, and buries the keel in
 * the sand. Scenery only: the shoal itself grounds a ship that comes this close.
 */
/** Share of the wreck's height sunk in the seabed. */
const BURIED = 0.08;
/** Height of the model as a share of its length (from the tool's report). */
const HEIGHT = 0.181;

export class WrecksView {
  constructor(private readonly scene: Scene, private readonly url: string) {}

  /** Loads the model and sets a copy on every site; without the file the shoals stay empty. */
  async place(sites: readonly WreckSite[]): Promise<void> {
    if (sites.length === 0) return;
    try {
      const container = await LoadAssetContainerAsync(this.url, this.scene);
      useStandardMaterials(container, this.scene, "wreck");
      sites.forEach((s, i) => {
        const at = new TransformNode(`wreck-${i}`, this.scene);
        at.position.set(s.x, s.seabed - s.length * HEIGHT * BURIED, s.z);
        at.rotation.set(0, s.heading, s.heel);
        at.scaling.setAll(s.length);
        const inst = container.instantiateModelsToScene((n) => `${n}-wreck-${i}`, false);
        for (const root of inst.rootNodes) root.parent = at;
      });
    } catch {
      // No model (offline build): no wrecks.
    }
  }
}
