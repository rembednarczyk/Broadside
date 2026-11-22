import { SPLASHES } from "../shaders/splash-foam";

/**
 * The newest splashes of shot on the sea, for the foam they leave (shaders/splash-foam): a ring
 * buffer of the last SPLASHES falls (Object Pool), each dropped after LIFE seconds. A 12-pounder's
 * splash (size about 1.2) leaves a patch of about 3.3 m across its radius. Pure, so the
 * uniforms are tested without a GPU.
 */
const LIFE = 8;

export interface SplashUniforms {
  readonly data: Float32Array;
  readonly count: number;
}

export class SplashPatches {
  private readonly list: { x: number; z: number; t: number; r: number }[] = [];

  /** A ball fell here at `time`; `size` the splash's size (sim: the cube root of the ball's mass). */
  add(x: number, z: number, size: number, time: number): void {
    this.list.push({ x, z, t: time, r: 1.5 + 1.5 * size });
    if (this.list.length > SPLASHES) this.list.shift();
  }

  uniforms(time: number): SplashUniforms {
    while (this.list.length && time - this.list[0]!.t > LIFE) this.list.shift();
    const data = new Float32Array(SPLASHES * 4);
    this.list.forEach((s, i) => data.set([s.x, s.z, Math.max(0, time - s.t), s.r], i * 4));
    return { data, count: this.list.length };
  }
}
