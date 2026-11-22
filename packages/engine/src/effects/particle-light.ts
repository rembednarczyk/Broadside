import { type SceneLook, sceneLook } from "../renderer/look";

/**
 * How brightly the scene lights its unlit particles (smoke, spray, splinters), per channel,
 * relative to the afternoon the particle colours were tuned under. Babylon's particles take no
 * lights, so without this the smoke kept its daylight grey at night and shone brighter than
 * the ship it hid (beta test 22.11). The light a puff receives is taken as a diffuse sphere's
 * average (Lambert): the sky's ambient plus half the key light (sun or moon), the same terms the
 * renderer feeds its hemispheric and directional lights. Additive fire (flash, flames, embers)
 * makes its own light and is not tinted. Simplification: no self-shadowing and no direction (a
 * puff against the sun is as bright as one beside it); lit billboards with normals would add both.
 */
export interface ParticleLight {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const received = (look: SceneLook): ParticleLight => {
  const key = look.keyIntensity * 0.5;
  return { r: look.ambient.r * 1.9 + look.keyColor.r * key, g: look.ambient.g * 1.9 + look.keyColor.g * key, b: look.ambient.b * 1.9 + look.keyColor.b * key };
};

/** The light the particle colours were tuned under: 14:00, the default sky. */
const REFERENCE = received(sceneLook(14, 0.55, 0));

export const particleLight = (look: SceneLook): ParticleLight => {
  const l = received(look);
  const c = (v: number, ref: number): number => Math.max(0.03, Math.min(1.15, v / ref));
  return { r: c(l.r, REFERENCE.r), g: c(l.g, REFERENCE.g), b: c(l.b, REFERENCE.b) };
};
