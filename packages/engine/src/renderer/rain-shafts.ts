import { type StormCell, CELLS } from "@broadside/core";
import { Color3, DynamicTexture, Mesh, MeshBuilder, type Scene, StandardMaterial } from "../babylon";

/**
 * Rain shafts under storm cells: the grey curtains a sailor sees coming across the sea. Each cell
 * is a veil of vertical streaks on an upright plane turned to face the camera about the vertical
 * (a cylindrical billboard, the usual impostor for rain curtains and distant smoke columns),
 * soft at its sides and fading up into the cloud base, fading in and out with the cell's life.
 * Seen from far off they warn of the squall; inside it, the rain particles take over.
 *
 * Owner's report 22.11: the shaft was an open cylinder whose silhouette stood on the horizon as a
 * hard-edged dark column, its open top a dark ring against the sky ("a black torus"). A billboard
 * has no silhouette of its own: its edges are the texture's, feathered to nothing.
 */
export const CURTAIN_HEIGHT = 420;

/** Opacity envelope of the curtain at (u across 0..1, v down from its top 0..1): pure, tested. */
export const curtainEnvelope = (u: number, v: number): number => {
  const across = Math.exp(-Math.pow(Math.abs(u - 0.5) / 0.3, 4));
  const up = Math.min(1, Math.max(0, v / 0.4));
  return across * up * up * (3 - 2 * up);
};

const streaks = (scene: Scene): DynamicTexture => {
  const w = 256;
  const h = 256;
  const tex = new DynamicTexture("rain-shaft", { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  // A grey veil (rain seen in depth) and streaks over it; a fixed integer sequence: the same curtain every run.
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(0, 0, w, h);
  let s = 9781;
  const next = (): number => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 3266489917) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 220; i++) {
    const x = next() * w;
    const y0 = next() * h * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + next() * 0.3})`;
    ctx.fillRect(x, y0, 1 + next() * 2, h - y0);
  }
  // Feather the sides and the top (the envelope), pixel by pixel on the alpha.
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4 + 3;
      img.data[k] = Math.round(img.data[k]! * curtainEnvelope((x + 0.5) / w, (y + 0.5) / h));
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update();
  tex.hasAlpha = true;
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
    this.material = m;
  }

  /** `eyeX/Z`: where the camera looks; a shaft fades as the view enters it (rain particles take over). */
  sync(cells: readonly StormCell[], eyeX: number, eyeZ: number): void {
    const seen = new Set<StormCell>();
    for (const c of cells) {
      seen.add(c);
      let mesh = this.meshes.get(c);
      if (!mesh) {
        mesh = MeshBuilder.CreatePlane("rain-shaft", { width: c.radius * 2.6, height: CURTAIN_HEIGHT }, this.scene);
        mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
        mesh.material = this.material;
        mesh.isPickable = false;
        this.meshes.set(c, mesh);
      }
      const life = Math.max(0, Math.min(1, c.age / CELLS.ramp, (c.life - c.age) / CELLS.ramp));
      const inside = Math.max(0, Math.min(1, (Math.hypot(eyeX - c.x, eyeZ - c.z) - c.radius * 0.6) / (c.radius * 0.8)));
      mesh.visibility = life * inside * (0.4 + 0.6 * c.strength);
      mesh.position.set(c.x, CURTAIN_HEIGHT / 2 - 10, c.z);
    }
    for (const [c, mesh] of this.meshes) {
      if (!seen.has(c)) {
        mesh.dispose();
        this.meshes.delete(c);
      }
    }
  }
}
