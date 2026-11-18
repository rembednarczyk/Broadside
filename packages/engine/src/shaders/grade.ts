/**
 * The final full-screen pass (one pass for everything screen-space, for the phone's fill rate):
 *  - lens droplets: a droplet map offsets the lookup (refraction through water on the lens);
 *  - underwater: teal absorption by depth, light shafts from the sun's screen position
 *    (radial streaks modulated by noise, a cheap stand-in for volumetric god rays), wobble;
 *  - lightning: a white-blue flash over the scene;
 *  - grade: luminance onto a sepia ramp (split-tone), then a filmic S-curve.
 */
export const GRADE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D dropSampler;
uniform float amount;
uniform float contrast;
uniform float drops;
uniform float underwater;
uniform float depth;
uniform vec2 sunScreen;
uniform float flash;
uniform float night;
uniform float time;
uniform float waterline;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 uv = vUV;
  // Droplet map: rg = refraction offset (0.5 = none), b = droplet mask.
  vec4 d = texture2D(dropSampler, uv * vec2(1.0, 0.6) + vec2(0.0, -time * 0.004));
  uv += (d.rg - 0.5) * 0.06 * d.b * drops;
  // Half in, half out: the surface crosses the lens as a wavering line; below it the view is the
  // underwater one, on it a blurred meniscus (the reference's camera through the surface).
  float wl = waterline + 0.012 * sin(uv.x * 14.0 + time * 2.3) + 0.006 * sin(uv.x * 37.0 - time * 3.1);
  float uw = waterline >= 0.0 ? step(uv.y, wl) : underwater;
  if (uw > 0.5) uv += vec2(sin(uv.y * 40.0 + time * 2.0), cos(uv.x * 35.0 + time * 1.7)) * 0.0025;
  vec3 c = texture2D(textureSampler, uv).rgb;
  float band = waterline >= 0.0 ? smoothstep(0.035, 0.0, abs(uv.y - wl)) : 0.0;
  if (band > 0.0) {
    vec3 blur = (texture2D(textureSampler, uv + vec2(0.0, 0.012)).rgb + texture2D(textureSampler, uv - vec2(0.0, 0.012)).rgb
      + texture2D(textureSampler, uv + vec2(0.01, 0.0)).rgb + texture2D(textureSampler, uv - vec2(0.01, 0.0)).rgb) * 0.25;
    c = mix(c, blur, band);
  }
  if (uw > 0.5) {
    float absorb = exp(-depth * 0.08);
    vec3 teal = vec3(0.04, 0.22, 0.2);
    c = mix(teal * 0.35, c * vec3(0.55, 0.95, 0.9), 0.55 * absorb);
    vec2 toSun = uv - sunScreen;
    float ang = atan(toSun.y, toSun.x);
    float rays = pow(vnoise(vec2(ang * 18.0, time * 0.3)), 3.0) * smoothstep(1.2, 0.0, length(toSun));
    c += vec3(0.5, 0.85, 0.75) * rays * 0.35 * absorb;
    c *= mix(0.25, 1.0, smoothstep(0.0, 0.9, 1.0 - uv.y * 0.0 - length(uv - vec2(0.5, 1.1)) * 0.6));
  }
  // The meniscus: a thin dark line with a bright edge where the surface meets the glass.
  c = mix(c, c * 0.55, smoothstep(0.006, 0.0, abs(uv.y - wl)) * step(0.0, waterline));
  c += vec3(0.25) * smoothstep(0.012, 0.004, abs(uv.y - wl - 0.008)) * step(0.0, waterline);
  // Droplets darken their rims slightly and catch a highlight.
  c = mix(c, c * 0.8 + vec3(0.06), d.b * drops * 0.35);
  // Lightning: a whiteout at the strike, then a cold blue cast that fades (reference s. 21).
  c = mix(c, vec3(0.95, 0.97, 1.0), smoothstep(0.75, 1.0, flash));
  c = mix(c, c * vec3(0.75, 0.9, 1.25) + vec3(0.03, 0.05, 0.09), min(1.0, flash * 1.5));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // The sepia ramp by day; at night it cools to a nearly neutral grey (the reference's night
  // shots, ref_060 to ref_080, are a warm dark grey with only the lights amber).
  vec3 shadow = mix(vec3(0.07, 0.055, 0.04), vec3(0.05, 0.046, 0.04), night);
  vec3 mid = mix(vec3(0.52, 0.43, 0.31), vec3(0.44, 0.41, 0.36), night);
  vec3 high = mix(vec3(1.0, 0.95, 0.84), vec3(0.94, 0.9, 0.82), night);
  vec3 sepia = l < 0.5 ? mix(shadow, mid, l * 2.0) : mix(mid, high, (l - 0.5) * 2.0);
  // Underwater keeps its teal; lightning washes the sepia out towards blue-white.
  float a = amount * (1.0 - uw * 0.8) * (1.0 - flash * 0.7);
  // Warm light keeps its colour through the toning (ref_075: lanterns and emblems lit from
  // behind glow amber in a grey night): bright, strongly warm pixels are toned less. Sunlit wood
  // is not warm enough to count.
  float warm = clamp((c.r - c.b) / max(c.r, 1e-3), 0.0, 1.0);
  a *= 1.0 - 0.75 * smoothstep(0.35, 0.75, warm) * smoothstep(0.25, 0.7, l);
  vec3 g = mix(c, sepia, a);
  g = clamp((g - 0.5) * contrast + 0.5, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g) * 0.35 + g * 0.65;
  gl_FragColor = vec4(g, 1.0);
}
`;
