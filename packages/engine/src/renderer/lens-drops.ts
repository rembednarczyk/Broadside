import { createRng, range } from "@broadside/core";
import { DynamicTexture, type Scene, Texture } from "../babylon";

/**
 * Droplet map for the lens: drawn once from a seed. Each drop is a dome: the red and green
 * channels hold its refraction offset (the slope of the dome, 128 = none), blue its mask.
 */
export const createDropTexture = (scene: Scene, seed = 7, size = 512): DynamicTexture => {
  const tex = new DynamicTexture("lens-drops", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "rgb(128,128,0)";
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const rng = createRng(seed);
  for (let n = 0; n < 140; n++) {
    const cx = range(rng, 0, size);
    const cy = range(rng, 0, size);
    const r = range(rng, 3, n < 12 ? 26 : 12);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = (x - cx) / r;
        const dy = (y - cy) / r;
        const q = dx * dx + dy * dy;
        if (q > 1 || x < 0 || y < 0 || x >= size || y >= size) continue;
        const i = (y * size + x) * 4;
        img.data[i] = 128 + dx * 110;
        img.data[i + 1] = 128 + dy * 110;
        img.data[i + 2] = 255 * Math.min(1, (1 - q) * 3);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update(false);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
};
