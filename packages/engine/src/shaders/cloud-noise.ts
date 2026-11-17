/**
 * Noise volume of the volumetric clouds for the top presets: a tiling 3D texture read by the sky
 * shader instead of computing the noise per sample (Schneider, "The Real-Time Volumetric
 * Cloudscapes of Horizon Zero Dawn", SIGGRAPH 2015, the "Perlin-Worley" base texture).
 * R, G, B: inverted cellular noise (Worley 1996) at 4, 8 and 16 cells to the tile, the nearest
 * feature point sought in all 27 neighbouring cells with wrap-around. A: tiling value noise in
 * three octaves, for bending the lookups. Unlike Schneider's texture the channels are kept apart
 * (the shader weighs them), and the Perlin part is plain value noise.
 * Deterministic: the feature points come from an integer hash of the cell, no random source.
 */
const hash = (x: number, y: number, z: number, salt: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(salt, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const wrap = (i: number, n: number): number => ((i % n) + n) % n;

/** Inverted Worley noise, period `cells`, at a point of the unit tile scaled to cell units. */
const worley = (x: number, y: number, z: number, cells: number): number => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const cz = Math.floor(z);
  let best = 4;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx;
        const iy = cy + dy;
        const iz = cz + dz;
        const wx = wrap(ix, cells);
        const wy = wrap(iy, cells);
        const wz = wrap(iz, cells);
        const px = ix + hash(wx, wy, wz, cells) - x;
        const py = iy + hash(wx, wy, wz, cells + 101) - y;
        const pz = iz + hash(wx, wy, wz, cells + 211) - z;
        const d = px * px + py * py + pz * pz;
        if (d < best) best = d;
      }
    }
  }
  return Math.max(0, 1 - Math.sqrt(best));
};

/** Tiling value noise, period `cells`, smoothstep interpolation. */
const value = (x: number, y: number, z: number, cells: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const at = (dx: number, dy: number, dz: number): number => hash(wrap(ix + dx, cells), wrap(iy + dy, cells), wrap(iz + dz, cells), 977);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const low = lerp(lerp(at(0, 0, 0), at(1, 0, 0), ux), lerp(at(0, 1, 0), at(1, 1, 0), ux), uy);
  const high = lerp(lerp(at(0, 0, 1), at(1, 0, 1), ux), lerp(at(0, 1, 1), at(1, 1, 1), ux), uy);
  return lerp(low, high, uz);
};

/** Edge of the cloud noise volume in texels. */
export const CLOUD_NOISE_SIZE = 64;

/** RGBA bytes of the volume, `size`³ texels, x fastest. */
export const cloudNoiseVolume = (size: number = CLOUD_NOISE_SIZE): Uint8Array => {
  const data = new Uint8Array(size * size * size * 4);
  let o = 0;
  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const u = (i + 0.5) / size;
        const v = (j + 0.5) / size;
        const w = (k + 0.5) / size;
        data[o++] = Math.round(255 * worley(u * 4, v * 4, w * 4, 4));
        data[o++] = Math.round(255 * worley(u * 8, v * 8, w * 8, 8));
        data[o++] = Math.round(255 * worley(u * 16, v * 16, w * 16, 16));
        const n = value(u * 4, v * 4, w * 4, 4) * 0.57 + value(u * 8, v * 8, w * 8, 8) * 0.29 + value(u * 16, v * 16, w * 16, 16) * 0.14;
        data[o++] = Math.round(255 * n);
      }
    }
  }
  return data;
};
