import { type GerstnerWave, waterHeight } from "@broadside/core";
import { Color3, Matrix, type Mesh, MeshBuilder, type Scene, StandardMaterial } from "../babylon";

/** A point where a broadside would fall (data from the app; see GameSession.salvoPreview). */
export interface SalvoMarkView {
  readonly x: number;
  readonly z: number;
  readonly locked: boolean;
  readonly ready: number;
}

/**
 * Aiming marks on the water (the fall-of-shot arc of Assassin's Creed IV: Black Flag): rings riding
 * the waves where each broadside would land. Two thin-instanced meshes (Flyweight): bright rings for
 * a battery laid on a target, faint ones for a battery firing blind or still reloading.
 */
export class SalvoMarks {
  private readonly hot: Mesh;
  private readonly cold: Mesh;
  private marks: readonly SalvoMarkView[] = [];
  visible = true;

  constructor(scene: Scene) {
    const make = (name: string, color: Color3, alpha: number): Mesh => {
      const m = MeshBuilder.CreateTorus(name, { diameter: 6, thickness: 0.8, tessellation: 20 }, scene);
      const mat = new StandardMaterial(`${name}-mat`, scene);
      mat.disableLighting = true;
      mat.emissiveColor = color;
      mat.alpha = alpha;
      m.material = mat;
      m.isPickable = false;
      m.isVisible = false;
      return m;
    };
    this.hot = make("salvo-hot", new Color3(1, 0.62, 0.22), 0.85);
    this.cold = make("salvo-cold", new Color3(0.95, 0.93, 0.86), 0.6);
  }

  set(marks: readonly SalvoMarkView[]): void {
    this.marks = marks;
  }

  /** `view`: half-height of the frame in metres; the rings keep a readable size on screen. */
  frame(waves: readonly GerstnerWave[], time: number, view = 60): void {
    const zoom = Math.max(1, view / 60);
    const hot: number[] = [];
    const cold: number[] = [];
    if (this.visible) {
      for (const m of this.marks) {
        // Above the shader's detail waves (the simulation surface is smoother than the drawn one).
        const y = waterHeight(waves, m.x, m.z, time) + 1.2;
        // A battery not yet loaded shows small rings that grow as the guns are run out.
        const s = (0.5 + 0.5 * m.ready) * zoom;
        (m.locked && m.ready > 0 ? hot : cold).push(...Matrix.Scaling(s, zoom, s).multiply(Matrix.Translation(m.x, y, m.z)).m);
      }
    }
    this.apply(this.hot, hot);
    this.apply(this.cold, cold);
  }

  private apply(mesh: Mesh, m: number[]): void {
    const n = m.length / 16;
    mesh.isVisible = n > 0;
    if (n > 0) mesh.thinInstanceSetBuffer("matrix", new Float32Array(m), 16, false);
  }

  dispose(): void {
    this.hot.dispose();
    this.cold.dispose();
  }
}
