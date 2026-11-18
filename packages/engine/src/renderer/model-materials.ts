import { type AssetContainer, Mesh, type Scene, StandardMaterial, type Texture, VertexData } from "../babylon";
import { WetDeck } from "./wet-deck";

/**
 * Turns a loaded model's PBR materials into StandardMaterials with the same colour texture and
 * normal map, like the rest of the scene (no image-based lighting, see decyzje 16.11). `gain`
 * multiplies the colour texture. Meshes without normals get them computed. `wet`: the faces that
 * look up get a wet sheen (wet-deck.ts; the hulls).
 */
export const useStandardMaterials = (container: AssetContainer, scene: Scene, prefix: string, gain = 1, wet = false): void => {
  // A mesh that lost its normals in the asset pipeline (cutting, welding) would shade black: rebuild them.
  // glTF data is right-handed: the normals are computed for that winding.
  for (const mesh of container.meshes) {
    if (!(mesh instanceof Mesh) || mesh.getTotalVertices() === 0 || mesh.isVerticesDataPresent("normal")) continue;
    const positions = mesh.getVerticesData("position");
    const indices = mesh.getIndices();
    if (!positions || !indices) continue;
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals, { useRightHandedSystem: true });
    mesh.setVerticesData("normal", normals);
  }
  // Iterate over a copy: the converted materials are added to the same list.
  for (const m of [...container.materials]) {
    const pbr = m as unknown as { albedoTexture?: Texture | null; bumpTexture?: Texture | null; invertNormalMapX?: boolean; invertNormalMapY?: boolean };
    const std = new StandardMaterial(`${prefix}-${m.name}`, scene);
    std.diffuseTexture = pbr.albedoTexture ?? null;
    // The loader sets which winding is the front face (glTF is right-handed): keep it, or the
    // inside of the model is drawn instead of its outside.
    std.sideOrientation = m.sideOrientation;
    std.backFaceCulling = m.backFaceCulling;
    // A double-sided model (thin planking seen from both sides) is lit on both sides.
    std.twoSidedLighting = !m.backFaceCulling;
    // Scans of dark, tarred timber read as black under one sun and a sky light: lift them. The
    // gain goes on the texture's level: the material clamps its own colour factor to 1.
    if (std.diffuseTexture) std.diffuseTexture.level = gain;
    // Keep the model's normal map (planking, ports, carvings) with the loader's handedness flags.
    if (pbr.bumpTexture) {
      std.bumpTexture = pbr.bumpTexture;
      std.invertNormalMapX = pbr.invertNormalMapX ?? false;
      std.invertNormalMapY = pbr.invertNormalMapY ?? false;
    }
    std.specularColor.set(0.06, 0.05, 0.04);
    if (wet) new WetDeck(std);
    for (const mesh of container.meshes) if (mesh.material === m) mesh.material = std;
    container.materials.push(std);
  }
};
