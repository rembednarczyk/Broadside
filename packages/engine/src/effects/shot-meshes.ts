import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, type Scene, StandardMaterial, Vector3 } from "../babylon";
import type { BurstEmitter } from "./burst-emitter";

/**
 * Shot in flight by its ammunition (beta test 22.11: every ball was the same dark sphere), as
 * thin instances of one mesh per kind (Flyweight): iron balls (round, heavy) sized by the gun's
 * pound, hot shot glowing orange (emissive above 1, so bloom takes it), chain shot as two half
 * balls on a bar tumbling end over end, grape as a cluster of small balls (the sim already flies
 * several). Each ball leaves a short grey streak of disturbed air and powder fouling behind it
 * (a stretched particle per ball per frame), so a ball 100 m off still reads against the sea.
 * Sizes are exaggerated about twice (a 12-pounder ball is 11.7 cm), as the old sphere was.
 */
export interface FlyingShot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly ammo: string;
  readonly pounder: number;
  readonly age: number;
}

type Kind = "iron" | "hot" | "chain" | "grape";

const kindOf = (ammo: string): Kind => (ammo === "hot" ? "hot" : ammo === "chain" ? "chain" : ammo === "grape" ? "grape" : "iron");

const chainMesh = (scene: Scene): Mesh => {
  const a = MeshBuilder.CreateSphere("fx-chain-a", { diameter: 0.26, segments: 4 }, scene);
  a.position.x = -0.55;
  const b = MeshBuilder.CreateSphere("fx-chain-b", { diameter: 0.26, segments: 4 }, scene);
  b.position.x = 0.55;
  const bar = MeshBuilder.CreateCylinder("fx-chain-bar", { height: 1.1, diameter: 0.05, tessellation: 5 }, scene);
  bar.rotation.z = Math.PI / 2;
  return Mesh.MergeMeshes([a, b, bar], true) ?? a;
};

export class ShotMeshes {
  private readonly meshes: Record<Kind, Mesh>;
  private readonly rot = new Quaternion();
  private readonly scale = new Vector3();
  private readonly pos = new Vector3();
  private readonly m = new Matrix();

  constructor(scene: Scene, private readonly trail: BurstEmitter) {
    const iron = new StandardMaterial("fx-iron", scene);
    iron.diffuseColor = new Color3(0.08, 0.08, 0.08);
    const hot = new StandardMaterial("fx-hot-shot", scene);
    hot.diffuseColor = new Color3(0.2, 0.05, 0);
    hot.emissiveColor = new Color3(2.4, 0.9, 0.25);
    hot.disableLighting = true;
    const chain = chainMesh(scene);
    chain.name = "fx-shot-chain";
    this.meshes = {
      iron: MeshBuilder.CreateSphere("fx-shot", { diameter: 0.3, segments: 4 }, scene),
      hot: MeshBuilder.CreateSphere("fx-shot-hot", { diameter: 0.3, segments: 4 }, scene),
      chain,
      grape: MeshBuilder.CreateSphere("fx-shot-grape", { diameter: 0.14, segments: 3 }, scene),
    };
    this.meshes.iron.material = iron;
    this.meshes.chain.material = iron;
    this.meshes.grape.material = iron;
    this.meshes.hot.material = hot;
    for (const m of Object.values(this.meshes)) {
      m.isPickable = false;
      m.isVisible = false;
    }
  }

  sync(shots: Iterable<FlyingShot>): void {
    const buffers: Record<Kind, number[]> = { iron: [], hot: [], chain: [], grape: [] };
    for (const s of shots) {
      const kind = kindOf(s.ammo);
      // Ball size grows with the cube root of its weight (12 pounds: the base size).
      const k = Math.cbrt(Math.max(1, s.pounder) / 12);
      this.scale.set(k, k, k);
      this.pos.set(s.x, s.y, s.z);
      if (kind === "chain") Quaternion.RotationYawPitchRollToRef(Math.atan2(s.vx, s.vz), 0, s.age * 25, this.rot);
      else this.rot.set(0, 0, 0, 1);
      Matrix.ComposeToRef(this.scale, this.rot, this.pos, this.m);
      const out = buffers[kind];
      for (let i = 0; i < 16; i++) out.push(this.m.m[i]!);
      const speed = Math.hypot(s.vx, s.vy, s.vz);
      if (speed > 30 && kind !== "grape") this.trail.emit(s.x, s.y, s.z, s.vx / speed, s.vy / speed, s.vz / speed, 1, 0.05);
    }
    for (const kind of Object.keys(buffers) as Kind[]) {
      const mesh = this.meshes[kind];
      const data = buffers[kind];
      mesh.isVisible = data.length > 0;
      if (data.length > 0) mesh.thinInstanceSetBuffer("matrix", new Float32Array(data), 16, false);
    }
  }

  dispose(): void {
    for (const m of Object.values(this.meshes)) m.dispose();
  }
}
