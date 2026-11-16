import { DynamicTexture, type Scene } from "../babylon";

/**
 * Particle sprites drawn procedurally (no downloaded textures, decision 16.11): a soft puff for
 * smoke and spray, a hot core for flashes and flames, a splinter streak. Generated once per scene.
 */
export interface Sprites {
  readonly puff: DynamicTexture;
  readonly flare: DynamicTexture;
  readonly streak: DynamicTexture;
}

const radial = (scene: Scene, name: string, stops: [number, string][], size = 64): DynamicTexture => {
  const t = new DynamicTexture(name, { width: size, height: size }, scene, false);
  const ctx = t.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  t.hasAlpha = true;
  t.update();
  return t;
};

export const createSprites = (scene: Scene): Sprites => {
  const puff = radial(scene, "fx-puff", [[0, "rgba(255,255,255,0.9)"], [0.45, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]]);
  const flare = radial(scene, "fx-flare", [[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,230,160,0.9)"], [1, "rgba(255,120,20,0)"]]);
  const streak = new DynamicTexture("fx-streak", { width: 32, height: 32 }, scene, false);
  const ctx = streak.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(13, 2, 6, 28);
  streak.hasAlpha = true;
  streak.update();
  return { puff, flare, streak };
};
