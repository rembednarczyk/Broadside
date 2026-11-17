import { type AssetContainer, LoadAssetContainerAsync, Mesh, type Scene } from "../babylon";
import { GLB, assetUrl } from "./asset-url";
import { useStandardMaterials } from "./model-materials";

/**
 * The crew's figures (tools/assets/crew-figures.mjs: Quaternius's CC0 characters posed and baked
 * into small static miniatures sharing one texture atlas), loaded once and shared by all ships (Prototype). Each
 * ship copies the meshes and draws its men as thin instances of them (Flyweight); until the file
 * has loaded, and on the low preset, the plain figures of ShipDetail stand in.
 */
export class CrewFigures {
  private container: AssetContainer | null = null;

  constructor(scene: Scene, url: string) {
    LoadAssetContainerAsync(assetUrl(url), scene, GLB).then(
      (c) => {
        useStandardMaterials(c, scene, "crew", 1);
        // The figures are copied without the loader's root (which turns glTF's right-handed data
        // into Babylon's frame): bake that root into the vertices, so faces and normals stay outward.
        for (const mesh of c.meshes) {
          if (!(mesh instanceof Mesh) || mesh.getTotalVertices() === 0) continue;
          mesh.setParent(null);
          mesh.bakeCurrentTransformIntoVertices();
        }
        this.container = c;
      },
      () => undefined,
    );
  }

  /** The figure meshes, once loaded (the file's own nodes carry no transform). */
  get templates(): Mesh[] | null {
    if (!this.container) return null;
    return this.container.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
  }
}
