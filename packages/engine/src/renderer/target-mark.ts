import { type GerstnerWave, waterHeight } from "@broadside/core";
import { Color3, type Mesh, MeshBuilder, type Scene, StandardMaterial } from "../babylon";

/**
 * The mark under the ship the player has chosen as her target (a tap on her): a red ring on the
 * water round her hull, breathing slowly so it reads as a selection, not an order (the selection
 * circle of strategy games). Riding the swell at her position; hidden with the HUD.
 */
export class TargetMark {
  private readonly ring: Mesh;
  private at: { x: number; z: number; size: number } | null = null;
  visible = true;

  constructor(scene: Scene) {
    this.ring = MeshBuilder.CreateTorus("target-mark", { diameter: 1, thickness: 0.035, tessellation: 48 }, scene);
    const m = new StandardMaterial("target-mark-mat", scene);
    m.disableLighting = true;
    m.emissiveColor = new Color3(0.95, 0.25, 0.18);
    m.alpha = 0.85;
    this.ring.material = m;
    this.ring.isPickable = false;
    this.ring.isVisible = false;
  }

  /** The marked ship's position and length (null: no mark). */
  set(at: { x: number; z: number; size: number } | null): void {
    this.at = at;
  }

  frame(waves: readonly GerstnerWave[], time: number): void {
    const a = this.at;
    this.ring.isVisible = this.visible && a !== null;
    if (!a) return;
    const d = a.size * (1.25 + 0.05 * Math.sin(time * 3));
    this.ring.scaling.set(d, d * 0.6, d);
    this.ring.position.set(a.x, waterHeight(waves, a.x, a.z, time) + 0.6, a.z);
  }
}
