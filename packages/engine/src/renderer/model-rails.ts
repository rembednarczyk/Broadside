import { Mesh, MeshBuilder, type Scene, type ShadowGenerator, type StandardMaterial, type TransformNode, Vector3 } from "../babylon";
import { type SideProfile } from "./side-profile";

/**
 * The rail of a modelled hull, made whole. Scans and art models come with their rails broken where
 * the rigging was cut away, or never had them all round: a cap rail is laid along the top of the
 * bulwark the asset tool measured (side-profile), on both sides from stern to bow, stepping at the
 * breaks of the castles, with stanchions under it wherever the model's own bulwark stops short.
 * Static geometry, merged into one mesh per ship.
 */
const RAIL = 0.075;
const POST = 0.055;

export const buildModelRails = (scene: Scene, parent: TransformNode, side: SideProfile, wood: StandardMaterial, shadows: ShadowGenerator | null): Mesh | null => {
  const parts: Mesh[] = [];
  for (const s of [1, -1] as const) {
    const { runs, posts } = side.railRuns(s);
    for (const run of runs) {
      // The rail sits on the bulwark, a hand inboard of its outer face.
      const path = run.map(([x, y, z]) => new Vector3(x - s * 0.12, y + RAIL, z));
      parts.push(MeshBuilder.CreateTube("rail", { path, radius: RAIL, tessellation: 6, cap: Mesh.CAP_ALL }, scene));
    }
    for (const p of posts) {
      const post = MeshBuilder.CreateCylinder("rail-post", { height: Math.max(0.2, p.to - p.from), diameter: POST * 2, tessellation: 6 }, scene);
      post.position.set(p.x - s * 0.12, (p.from + p.to) / 2, p.z);
      parts.push(post);
    }
  }
  if (parts.length === 0) return null;
  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) return null;
  merged.name = `rails-${parent.name}`;
  merged.material = wood;
  merged.parent = parent;
  merged.isPickable = false;
  shadows?.addShadowCaster(merged);
  return merged;
};
