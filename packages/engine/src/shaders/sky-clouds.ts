/**
 * GLSL of the volumetric clouds, spliced into the sky fragment shader (it uses that shader's
 * uniforms and its `hash`, `vnoise` and `hg`). `steps`: samples along the view ray.
 */
export const volumetricClouds = (steps: number): string => /* glsl */ `
// Volumetric clouds (high presets): a slab of cumulus marched along the view ray, in the manner of
// Schneider's "The Real-Time Volumetric Cloudscapes of Horizon Zero Dawn" (SIGGRAPH 2015) cut down
// to a sky dome: density from 3D value-noise fbm shaped by a height profile (flat bases, rounded
// tops), lit by a short march towards the sun (Beer-Lambert), with the "powder" darkening of
// edges facing the sun and a dual-lobe Henyey-Greenstein phase for the silver lining.
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), u.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), u.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
const float CLOUD_BASE = 0.9;
const float CLOUD_TOP = 4.4;
float cloudDensity(vec3 p, bool fine) {
  float hgt = (p.y - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE);
  vec2 w = windOffset * 0.0005;
  // Where the heaps stand, and how high each towers: a coverage map over the sea (cumulus cells
  // with clear sky between them), thinning with distance instead of ending at the march's limit.
  float cov = vnoise(p.xz * 0.2 + w) * 0.62 + vnoise(p.xz * 0.47 + w * 1.6 + 9.0) * 0.38;
  float tower = smoothstep(0.7 - cloudCover * 0.42, 0.95 - cloudCover * 0.42, cov) * (1.0 - smoothstep(13.0, 22.0, length(p.xz)));
  if (tower <= 0.0) return 0.0;
  float top = 0.22 + 0.78 * tower;
  // Flat base, rounded head.
  float profile = smoothstep(0.0, 0.07, hgt) * smoothstep(top, top * 0.5, hgt);
  float v = tower * profile;
  if (v < 0.02) return 0.0;
  // Billows eat into the heap from outside, more towards its head: the cauliflower surface.
  vec3 q = p * 1.15 + vec3(w.x, 0.0, w.y) * 2.0;
  float lobes = 1.0 - abs(2.0 * vnoise3(q) - 1.0);
  float erode = lobes * 0.6;
  if (fine) erode = erode * 0.55 + (1.0 - abs(2.0 * vnoise3(q * 2.7 + 4.0) - 1.0)) * 0.38 + (1.0 - abs(2.0 * vnoise3(q * 6.1 + 1.0) - 1.0)) * 0.2;
  v -= (1.0 - erode) * (0.42 + 0.4 * hgt);
  return clamp(v * 5.5, 0.0, 1.0);
}
// rgb: light scattered to the eye; a: transmittance of what lies behind.
vec4 marchClouds(vec3 d, float sunUp) {
  if (d.y < 0.015) return vec4(0.0, 0.0, 0.0, 1.0);
  float t0 = CLOUD_BASE / d.y;
  float t1 = min(CLOUD_TOP / d.y, t0 + 18.0);
  const int STEPS = ${steps};
  float dt = (t1 - t0) / float(STEPS);
  // Dither the start by a screen-space hash to hide the slices.
  float t = t0 + dt * hash(gl_FragCoord.xy);
  float c = dot(d, sunDirection);
  float phase = min(mix(hg(c, 0.8), hg(c, -0.25), 0.3) * 5.0, 1.3) + 0.25;
  vec3 sunL = normalize(sunDirection + vec3(0.0, 0.25, 0.0));
  float T = 1.0;
  vec3 light = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = d * t;
    float dens = cloudDensity(p, true);
    if (dens > 0.01) {
      float toSun = 0.0;
      for (int k = 1; k <= 4; k++) toSun += cloudDensity(p + sunL * float(k) * 0.4, false);
      float beer = exp(-toSun * 3.2);
      float powder = 1.0 - exp(-dens * 3.0);
      float hgt = (p.y - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE);
      vec3 ambient = mix(skyHorizon * 0.22, mix(skyHorizon, skyZenith, 0.4) * 0.8, hgt) * (0.5 + 0.5 * sunUp);
      vec3 lit = ambient + sunColor * beer * mix(powder, 1.0, 0.35) * phase * 0.5 * sunUp;
      float a = 1.0 - exp(-dens * dt * 2.6);
      light += T * a * lit;
      T *= 1.0 - a;
      if (T < 0.03) break;
    }
    t += dt;
  }
  // Far clouds sink into the haze of the horizon.
  float far = smoothstep(0.02, 0.2, d.y);
  return vec4(mix(skyHorizon * (1.0 - T), light, far), T);
}

`;
