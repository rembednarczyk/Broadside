/** Splashes handed to the ocean shader at once (renderer/splash-patches.ts keeps the newest). */
export const SPLASHES = 12;

/**
 * GLSL of the foam a ball leaves where it struck the water (beta test of the firing effects: the
 * column fell back and left the sea as it was). Each splash is a disc of white water that spreads
 * as it ages (a quarter of its size again per second) and fades over about three seconds, densest
 * at its heart: the rings of churned water round a fall of shot. `splashFoam(p)` returns 0..1;
 * the fragment shader draws it as lace with the wake's foam.
 */
export const SPLASH_FOAM = /* glsl */ `
uniform vec4 splash[${SPLASHES}];
uniform int splashCount;

float splashFoam(vec2 p) {
  float f = 0.0;
  for (int i = 0; i < ${SPLASHES}; i++) {
    if (i >= splashCount) break;
    vec4 s = splash[i];
    vec2 d = p - s.xy;
    float r = s.w * (1.0 + s.z * 0.25);
    float q = dot(d, d) / (r * r);
    if (q >= 1.0) continue;
    float k = 1.0 - q;
    f = max(f, k * sqrt(k) * 0.75 * exp(-s.z / 3.0));
  }
  return f;
}
`;
