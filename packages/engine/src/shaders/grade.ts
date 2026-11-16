/**
 * Final grade after the visual reference: luminance mapped onto a sepia ramp (dark umber to warm
 * cream), blended with the source colour, then a filmic S-curve. A split-toning style grade
 * (shadows and highlights tinted separately), done in one full-screen pass.
 */
export const GRADE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float amount;
uniform float contrast;
void main() {
  vec3 c = texture2D(textureSampler, vUV).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 shadow = vec3(0.07, 0.055, 0.04);
  vec3 mid = vec3(0.52, 0.43, 0.31);
  vec3 high = vec3(1.0, 0.95, 0.84);
  vec3 sepia = l < 0.5 ? mix(shadow, mid, l * 2.0) : mix(mid, high, (l - 0.5) * 2.0);
  vec3 g = mix(c, sepia, amount);
  // S-curve around mid grey.
  g = clamp((g - 0.5) * contrast + 0.5, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g) * 0.35 + g * 0.65;
  gl_FragColor = vec4(g, 1.0);
}
`;
