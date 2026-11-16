import { type StormCell, CELLS } from "@broadside/core";
import { Color3, DynamicTexture, FresnelParameters, type Mesh, MeshBuilder, type Scene, StandardMaterial } from "../babylon";

/**
 * Rain shafts under storm cells: the grey curtains a sailor sees coming across the sea. Each cell
 * is an open, tapered cylinder with a texture of vertical streaks (alpha), fading in and out with
 * the cell's life. Seen from far off they warn of the squall; inside it, the rain particles take over.
 */
const streaks = (scene: Scene): DynamicTexture => {
  const size = 256;
  const tex = new DynamicTexture("rain-shaft", { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  // A fixed integer sequence for the streaks (the same curtain every run).
  let h = 9781;
  const next = (): number => {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) + 3266489917) >>> 0;
    return h / 4294967296;
  };
  for (let i = 0; i < 260; i++) {
    const x = next() * size;
    const g = ctx.createLinearGradient(0, 0, 0, size);
    const a = 0.08 + next() * 0.22;
    g.addColorStop(0, `rgba(255,255,255,${a * 1.4})`);
    g.addColorStop(0.6, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 1 + next() * 3, size);
  }
  tex.update();
  tex.hasAlpha = true;
  tex.uScale = 5;
  return tex;
};

export class RainShafts {
  private readonly meshes = new Map<StormCell, Mesh>();
  private readonly material: StandardMaterial;

  constructor(private readonly scene: Scene) {
    const m = new StandardMaterial("rain-shaft-mat", scene);
    const tex = streaks(scene);
    m.diffuseColor = new Color3(0.42, 0.44, 0.47);
    m.emissiveColor = new Color3(0.2, 0.21, 0.23);
    m.opacityTexture = tex;
    m.backFaceCulling = false;
    m.disableLighting = true;
    // Thin at the grazing edges of the cylinder, dense where the eye looks through the middle.
    const fresnel = new FresnelParameters();
    fresnel.leftColor = Color3.Black();
    fresnel.rightColor = Color3.White();
    fresnel.power = 2;
    fresnel.bias = 0.05;
    m.opacityFresnelParameters = fresnel;
    this.material = m;
  }

  /** `eyeX/Z`: where the camera looks; a shaft fades as the view enters it (rain particles take over). */
  sync(cells: readonly StormCell[], eyeX: number, eyeZ: number): void {
    const seen = new Set<StormCell>();
    for (const c of cells) {
      seen.add(c);
      let mesh = this.meshes.get(c);
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder("rain-shaft", { height: 420, diameterBottom: c.radius * 1.3, diameterTop: c.radius * 1.7, tessellation: 24, cap: 0 }, this.scene);
        mesh.material = this.material;
        mesh.isPickable = false;
        this.meshes.set(c, mesh);
      }
      const life = Math.max(0, Math.min(1, c.age / CELLS.ramp, (c.life - c.age) / CELLS.ramp));
      const inside = Math.max(0, Math.min(1, (Math.hypot(eyeX - c.x, eyeZ - c.z) - c.radius * 0.6) / (c.radius * 0.8)));
      mesh.visibility = life * inside * (0.4 + 0.6 * c.strength);
      mesh.position.set(c.x, 200, c.z);
    }
    for (const [c, mesh] of this.meshes) {
      if (!seen.has(c)) {
        mesh.dispose();
        this.meshes.delete(c);
      }
    }
  }
}
