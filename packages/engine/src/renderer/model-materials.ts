import { type AssetContainer, type Scene, StandardMaterial, type Texture } from "../babylon";

/**
 * Turns a loaded model's PBR materials into StandardMaterials with the same colour texture and
 * normal map, like the rest of the scene (no image-based lighting, see decyzje 16.11). `gain`
 * multiplies the colour texture.
 */
export const useStandardMaterials = (container: AssetContainer, scene: Scene, prefix: string, gain = 1): void => {
  // Iterate over a copy: the converted materials are added to the same list.
  for (const m of [...container.materials]) {
    const pbr = m as unknown as { albedoTexture?: Texture | null; bumpTexture?: Texture | null; invertNormalMapX?: boolean; invertNormalMapY?: boolean };
    const std = new StandardMaterial(`${prefix}-${m.name}`, scene);
    std.diffuseTexture = pbr.albedoTexture ?? null;
    // Scans of dark, tarred timber read as black under one sun and a sky light: lift them.
    std.diffuseColor.set(gain, gain, gain);
    // Keep the model's normal map (planking, ports, carvings) with the loader's handedness flags.
    if (pbr.bumpTexture) {
      std.bumpTexture = pbr.bumpTexture;
      std.invertNormalMapX = pbr.invertNormalMapX ?? false;
      std.invertNormalMapY = pbr.invertNormalMapY ?? false;
    }
    std.specularColor.set(0.06, 0.05, 0.04);
    for (const mesh of container.meshes) if (mesh.material === m) mesh.material = std;
    container.materials.push(std);
  }
};
