import { Mesh, MeshBuilder, type Scene, type ShadowGenerator, type StandardMaterial, type TransformNode, Vector3, VertexData } from "../babylon";
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

/**
 * Decks over the castles the cut left open (side-profile's `deckCaps`): a planked deck from side to
 * side along each run, so the hull is not seen hollow from above. One mesh per ship.
 */
export const buildModelDecks = (scene: Scene, parent: TransformNode, side: SideProfile, deck: StandardMaterial): Mesh | null => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const run of side.deckCaps()) {
    const base = positions.length / 3;
    // The first and last stations are carried half a station on, to meet the castle's end walls.
    const step = run.length > 1 ? run[1]!.z - run[0]!.z : 0;
    run.forEach((s, i) => {
      const z = s.z + (i === 0 ? -step / 2 : i === run.length - 1 ? step / 2 : 0);
      positions.push(-s.half, s.y, z, s.half, s.y, z);
      normals.push(0, 1, 0, 0, 1, 0);
      // Planks run fore and aft: u across the deck, v along it (one tile to four metres, as the generated decks).
      uvs.push(0, z / 4, 1, z / 4);
      if (i > 0) {
        const a = base + (i - 1) * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
  }
  if (indices.length === 0) return null;
  const mesh = new Mesh(`decks-${parent.name}`, scene);
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.uvs = uvs;
  data.indices = indices;
  data.applyToMesh(mesh);
  mesh.material = deck;
  mesh.parent = parent;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  return mesh;
};
