import { type Archipelago, type PortSite } from "@broadside/core";
import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, type Scene, StandardMaterial, Vector3, VertexData } from "../babylon";
import { townLayout } from "./town-layout";

/**
 * Harbour towns: whitewashed walls and dark tiled roofs (thin instances of a box and a gable
 * prism), a timber pier on piles, lanterns that glow at night.
 */
const gablePrism = (scene: Scene): Mesh => {
  // Unit gable roof: ridge along z, eaves at x = +-0.5, height 1.
  const p = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5];
  const i = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4];
  const m = new Mesh("roof", scene);
  const d = new VertexData();
  d.positions = p;
  d.indices = i;
  const n: number[] = [];
  VertexData.ComputeNormals(p, i, n);
  d.normals = n;
  d.applyToMesh(m);
  return m;
};

export class TownsView {
  readonly meshes: Mesh[] = [];
  private readonly lanternMat: StandardMaterial;

  constructor(scene: Scene, a: Archipelago, ports: readonly PortSite[]) {
    const walls = new StandardMaterial("town-walls", scene);
    walls.diffuseColor = new Color3(0.72, 0.68, 0.6);
    walls.specularColor = new Color3(0.02, 0.02, 0.02);
    const roofs = new StandardMaterial("town-roofs", scene);
    roofs.diffuseColor = new Color3(0.32, 0.18, 0.12);
    roofs.backFaceCulling = false;
    const timber = new StandardMaterial("pier", scene);
    timber.diffuseColor = new Color3(0.28, 0.2, 0.13);
    this.lanternMat = new StandardMaterial("town-lantern", scene);
    this.lanternMat.emissiveColor = new Color3(1.4, 0.9, 0.45);
    this.lanternMat.disableLighting = true;
    const house = MeshBuilder.CreateBox("house", { size: 1 }, scene);
    house.material = walls;
    const roof = gablePrism(scene);
    roof.material = roofs;
    const lamp = MeshBuilder.CreateSphere("pier-lamp", { diameter: 0.6, segments: 4 }, scene);
    lamp.material = this.lanternMat;
    const hm: number[] = [];
    const rm: number[] = [];
    const lm: number[] = [];
    const piers: Mesh[] = [];
    for (const p of ports) {
      const t = townLayout(a, p);
      for (const h of t.houses) {
        const q = Quaternion.RotationAxis(Vector3.Up(), h.yaw);
        hm.push(...Matrix.Compose(new Vector3(h.w, h.h + 2, h.d), q, new Vector3(h.x, h.y + (h.h - 2) / 2, h.z)).m);
        rm.push(...Matrix.Compose(new Vector3(h.w * 1.15, h.w * 0.45, h.d * 1.1), q, new Vector3(h.x, h.y + h.h, h.z)).m);
      }
      const len = Math.hypot(t.pier.x1 - t.pier.x0, t.pier.z1 - t.pier.z0);
      const deck = MeshBuilder.CreateBox("pier-deck", { width: t.pier.width, height: 0.6, depth: len }, scene);
      deck.position.set((t.pier.x0 + t.pier.x1) / 2, 2.2, (t.pier.z0 + t.pier.z1) / 2);
      deck.rotation.y = Math.atan2(t.pier.x1 - t.pier.x0, t.pier.z1 - t.pier.z0);
      piers.push(deck);
      for (const l of t.lanterns) lm.push(...Matrix.Translation(l.x, l.y, l.z).m);
    }
    house.thinInstanceSetBuffer("matrix", new Float32Array(hm), 16, true);
    roof.thinInstanceSetBuffer("matrix", new Float32Array(rm), 16, true);
    lamp.thinInstanceSetBuffer("matrix", new Float32Array(lm), 16, true);
    const pier = piers.length ? Mesh.MergeMeshes(piers, true, true) : null;
    if (pier) pier.material = timber;
    this.meshes.push(house, roof, lamp, ...(pier ? [pier] : []));
  }

  /** Lanterns glow with the darkness (0 day .. 1 night). */
  setNight(darkness: number): void {
    const k = 0.2 + 1.4 * Math.max(0, Math.min(1, darkness));
    this.lanternMat.emissiveColor = new Color3(k, k * 0.65, k * 0.32);
  }
}
