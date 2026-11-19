import { type AbstractMesh, Mesh, type Scene, StandardMaterial, type Texture, type TransformNode, VertexData } from "../babylon";
import { type ShipClassId } from "@broadside/core";
import { type HullModels } from "./hull-models";
import { type SideProfile } from "./side-profile";

/**
 * The decks of a modelled hull in the hull's own planking (decyzje 19.11: the model's deck was
 * near black from above and the generated decks' Poly Haven planks did not match the side).
 * The texture is the patch of the side baked by tools/assets/hull-patches.mjs (`HullModels.planks`),
 * its strakes laid fore and aft at their measured size; the colour is lifted above the side's,
 * as a deck scrubbed and bleached in the sun is (and so it reads at the game's distance).
 * Texture mapping as for the castle walls (model-castle), in metres: u along the ship, v across.
 */
export interface DeckPlanks {
  readonly material: StandardMaterial;
  /** Size of one tile of planking (metres): along the ship, across it. */
  readonly w: number;
  readonly h: number;
}

/** Shared per class (one material for every ship of the class). */
export const deckPlanks = (scene: Scene, deck: StandardMaterial, planks: { texture: Texture; w: number; h: number } | null, key: string): DeckPlanks | null => {
  if (!planks) return null;
  const name = `deck-planks-${key}`;
  const material = (scene.getMaterialByName(name) as StandardMaterial | null) ?? (() => {
    const m = new StandardMaterial(name, scene);
    m.diffuseTexture = planks.texture;
    m.diffuseColor.set(1.5, 1.25, 0.98);
    // The wet sheen of the generated deck (ship-view: a deck at sea is wet with spray).
    m.specularColor = deck.specularColor.clone();
    m.specularPower = deck.specularPower;
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
    return m;
  })();
  return { material, w: planks.w, h: planks.h };
};

/** Texture coordinates of a deck point: the planks' own size, else the generated decks' tiling (u across 0..1, v a tile to 4 m). */
export const deckUv = (p: DeckPlanks | null, x: number, z: number, across: number): [number, number] => (p ? [z / p.w, x / p.h] : [across, z / 4]);

/**
 * Strips of deck from side to side along runs of [half-breadth, y, z] (side-profile's `deckCaps`
 * and `openDecks`), carried half a station on at the ends to meet the walls. One mesh.
 */
export const buildDeckStrips = (scene: Scene, parent: TransformNode, name: string, runs: readonly (readonly { half: number; y: number; z: number }[])[], planks: DeckPlanks | null, fallback: StandardMaterial, lift = 0): Mesh | null => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const run of runs) {
    const base = positions.length / 3;
    const step = run.length > 1 ? run[1]!.z - run[0]!.z : 0;
    run.forEach((s, i) => {
      const z = s.z + (i === 0 ? -step / 2 : i === run.length - 1 ? step / 2 : 0);
      positions.push(-s.half, s.y + lift, z, s.half, s.y + lift, z);
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(...deckUv(planks, -s.half, z, 0), ...deckUv(planks, s.half, z, 1));
      if (i > 0) {
        const a = base + (i - 1) * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
  }
  if (indices.length === 0) return null;
  const mesh = new Mesh(`${name}-${parent.name}`, scene);
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.uvs = uvs;
  data.indices = indices;
  data.applyToMesh(mesh);
  mesh.material = planks?.material ?? fallback;
  mesh.parent = parent;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  return mesh;
};

/** Height of the planked deck at z (the strip within a station's length), or null off the strips. */
export const openDeckAt = (runs: readonly (readonly { half: number; y: number; z: number }[])[], lift: number) => (z: number): number | null => {
  for (const run of runs) {
    const step = run.length > 1 ? Math.abs(run[1]!.z - run[0]!.z) : 1;
    for (const s of run) if (Math.abs(s.z - z) <= step / 2 + 1e-6) return s.y + lift;
  }
  return null;
};

/**
 * The model's own decks in the planking: caps over the castles the cut left open, and strips a few
 * centimetres over its open decks forward of `from` (the waist and a forecastle), at the heights
 * found by casting rays down into the model (HullModels.decks), from just under the bulwark's top
 * to 4 m below it. Returns the height of the open decks at z, for the crew to stand on (null without them).
 */
export const buildModelDecks = (scene: Scene, parent: TransformNode, side: SideProfile, deck: StandardMaterial, planks: DeckPlanks | null, model: { hulls: HullModels; id: ShipClassId; meshes: readonly AbstractMesh[]; from: number } | null): ((z: number) => number | null) | null => {
  buildDeckStrips(scene, parent, "decks", side.deckCaps(), planks, deck);
  if (!planks || !model) return null;
  const stations = side.deckStations(model.from);
  const ys = model.hulls.decks(model.id, model.meshes, parent, stations.map((s) => ({ z: s.z, from: s.top - 0.3, half: s.half })), 4);
  const runs = side.openDecks(stations, ys);
  buildDeckStrips(scene, parent, "open-decks", runs, planks, deck, LIFT);
  return openDeckAt(runs, LIFT);
};

/** The open decks lie this far over the model's (no flicker where they meet). */
const LIFT = 0.03;
