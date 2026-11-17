/** GLSL of the clouds' shape: the noises and `cloudDensity`. `tex`: lumps read from the noise volume. */
const cloudShape = (tex: boolean): string => /* glsl */ `
${tex ? "precision highp sampler3D;\nuniform sampler3D cloudNoise;" : ""}
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
// Inverted cellular noise (Worley 1996): 1 at a feature point, falling to 0 between them. A union
// of round lumps with sharp creases where they meet, the "cauliflower" of Schneider's Perlin-Worley
// base shape. The nearest point is sought in the 2x2x2 cells round the sample, with the points kept
// to the middle 70% of their cells so that one further off is rarely the nearest.
float billow(vec3 p) {
  vec3 c = floor(p - 0.5);
  float best = 1.0;
  for (int i = 0; i < 8; i++) {
    vec3 o = c + vec3(mod(float(i), 2.0), mod(floor(float(i) * 0.5), 2.0), floor(float(i) * 0.25));
    vec3 h = fract(sin(vec3(dot(o, vec3(127.1, 311.7, 74.7)), dot(o, vec3(269.5, 183.3, 246.1)), dot(o, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
    vec3 r = o + 0.15 + 0.7 * h - p;
    best = min(best, dot(r, r));
  }
  return 1.0 - sqrt(best);
}
const float CLOUD_BASE = 0.9;
const float CLOUD_TOP = 13.0;
float cloudDensity(vec3 p, bool fine) {
  float hgt = (p.y - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE);
  vec2 w = windOffset * 0.0005;
  // Where the heaps stand, and how high each towers: a coverage map over the sea (cumulus cells
  // with clear sky between them), thinning with distance instead of ending at the march's limit.
  // None stand right overhead: from under its flat base a heap is a grey ceiling, and the heaps
  // of the reference are seen from the side, towering round the horizon.
  float cov = vnoise(p.xz * 0.1 + w) * 0.62 + vnoise(p.xz * 0.24 + w * 1.6 + 9.0) * 0.38;
  float tower = smoothstep(0.55 - cloudCover * 0.42, 0.86 - cloudCover * 0.42, cov) * (1.0 - smoothstep(26.0, 40.0, length(p.xz))) * smoothstep(6.0, 11.0, length(p.xz));
  if (tower <= 0.0) return 0.0;
  float top = 0.2 + 0.8 * tower;
  // Flat base, rounded head.
  float base = tower * smoothstep(0.0, 0.06, hgt) * smoothstep(top, top * 0.35, hgt);
  if (base < 0.02) return 0.0;
  // The heap is carved by the inverse of the lumps (Schneider's remap): thin parts of the base
  // shape are eaten away first, so the outline breaks into rounded heads while the core stays solid.
  vec3 q = p * 0.2 + vec3(w.x, 0.0, w.y) * 2.0;
${tex ? `  // Bent by a slow noise first, so the cells of the lumps do not show as a grid; then the lumps at
  // three sizes in one lookup (the channels of the volume: 4, 8 and 16 cells to the tile).
  q += (texture(cloudNoise, q * 0.21).a - 0.5) * vec3(0.4, 0.25, -0.35);
  vec3 n = texture(cloudNoise, q * 0.25).rgb;
  float lumps = n.r * 0.66 + n.g * 0.24 + n.b * 0.1;
` : `  // Bent by a slow noise first, so the cells of the lumps do not show as a grid.
  q += (vnoise3(q * 0.9) - 0.5) * vec3(0.5, 0.32, -0.42);
  // Three sizes of lump, each about half the last: the great masses, the heads on them, the knobs
  // (the knobs only where the detail is asked for: the far samples of the light march do without).
  float lumps = billow(q) * 0.66 + billow(q * 2.1 + 7.0) * 0.24 + (fine ? billow(q * 4.3 + 3.0) : 0.5) * 0.1;
`}
  // The lumps stand out towards the head; the foot of the heap is a smooth wall sunk in haze.
  float crown = smoothstep(0.1, 0.75, hgt / top);
  float carve = (1.0 - smoothstep(0.18, 0.62, lumps)) * (0.5 + 0.4 * crown);
  float shape = clamp((base - carve) / (1.0 - carve), 0.0, 1.0);
  if (shape <= 0.0) return 0.0;
${tex ? `  if (fine) {
    // Knobs at three finer sizes bite into the surface, least in the solid core: the cauliflower.
    vec3 k = texture(cloudNoise, q * 1.13 + 0.37).rgb;
    float puffs = k.r * 0.5 + k.g * 0.32 + k.b * 0.18;
    shape -= (1.0 - smoothstep(0.2, 0.62, puffs)) * 0.7 * (1.0 - shape) * (0.65 + 0.35 * crown);
  }
` : `  if (fine) {
    // Small lumps bite into the surface, least in the solid core, and a wisp of plain noise
    // softens the outline.
    float puffs = billow(q * 5.0 + 4.0) * 0.5 + vnoise3(q * 11.0 + 9.0) * 0.5;
    shape -= (1.0 - smoothstep(0.15, 0.7, puffs)) * 0.5 * (1.0 - shape) * (0.65 + 0.35 * crown);
  }
`}
  return clamp(shape * 4.0, 0.0, 1.0);
}
`;

/**
 * GLSL of the volumetric clouds, spliced into the sky fragment shader (it uses that shader's
 * uniforms and its `hash`, `vnoise` and `hg`). `steps`: samples along the view ray. `tex`: read the
 * lumps from the noise volume of `cloud-noise.ts` (sampler3D `cloudNoise`, WebGL2) instead of
 * computing them per sample: cheaper, so that variant affords more sizes of lump and a longer
 * light march.
 */
export const volumetricClouds = (steps: number, tex = false): string => /* glsl */ `
${cloudShape(tex)}
// rgb: light scattered to the eye; a: transmittance of what lies behind.
vec4 marchClouds(vec3 d, float sunUp) {
  float lid = 1.0 - 0.9 * smoothstep(0.35, 0.8, cloudCover);
  if (d.y < 0.015) return vec4(skyHorizon * 0.5 * (1.0 - lid), lid);
  float t0 = CLOUD_BASE / d.y;
  float t1 = min(CLOUD_TOP / d.y, t0 + 26.0);
  const int STEPS = ${steps};
  float dt = (t1 - t0) / float(STEPS);
  // Dither the start by a screen-space hash to hide the slices.
  // Interleaved gradient noise (Jimenez 2014): a dither that the eye reads as even grain, not speckle.
  float t = t0 + dt * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float c = dot(d, sunDirection);
  float phase = min(mix(hg(c, 0.8), hg(c, -0.25), 0.3) * 5.0, 3.2) + 0.42;
  vec3 sunL = normalize(sunDirection + vec3(0.0, 0.25, 0.0));
  float T = 1.0;
  vec3 light = vec3(0.0);
  // Coarse steps through clear air; inside a cloud each step is taken in six (the detail and the
  // edges need the finer stride, empty sky does not).
  for (int i = 0; i < STEPS; i++) {
    if (cloudDensity(d * (t + dt * 0.5), false) > 0.0 || cloudDensity(d * t, false) > 0.0) {
      float ds = dt / 6.0;
      for (int j = 0; j < 6; j++) {
        vec3 p = d * (t + ds * float(j));
        float dens = cloudDensity(p, true);
        if (dens <= 0.01) continue;
        // Optical depth towards the sun: four samples at growing steps (near detail, far bulk).
        float toSun = 0.0;
        float reach = ${tex ? "0.09" : "0.12"};
        for (int k = 0; k < ${tex ? 6 : 4}; k++) {
          toSun += cloudDensity(p + sunL * reach, k < ${tex ? 3 : 1}) * reach;
          reach *= ${tex ? "1.75" : "2.3"};
        }
        // Beer-Lambert with a second, slower term for light scattered many times inside the cloud
        // (Wrenninge's approximation): the shaded side is dark but not black.
        float beer = max(exp(-toSun * 9.0), 0.3 * exp(-toSun * 1.1));
        // Light of the sky from above, shut out in the creases between the lumps: the relief of the
        // shaded side (one sample upwards, the cheapest ambient occlusion).
        float open = exp(-cloudDensity(p + vec3(0.0, 0.45, 0.0), ${tex ? "true" : "false"}) * 1.4);
        float powder = 1.0 - exp(-dens * 4.0);
        float hgt = (p.y - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE);
        vec3 ambient = mix(skyHorizon * 0.4, mix(skyHorizon, skyZenith, 0.35) * 0.8, sqrt(hgt)) * (0.45 + 0.55 * sunUp) * (0.35 + 0.65 * open);
        vec3 lit = ambient + sunColor * beer * mix(powder, 1.0, 0.45) * phase * 2.0 * sunUp;
        float a = 1.0 - exp(-dens * ds * 4.5);
        light += T * a * lit;
        T *= 1.0 - a;
      }
      if (T < 0.02) break;
    }
    t += dt;
  }
  // Far clouds sink into the haze of the horizon.
  float far = smoothstep(0.02, 0.1, d.y);
  float rise = smoothstep(0.015, 0.07, d.y);
  // Below the nearest bases the eye looks along the whole deck of cloud: under a heavy sky that
  // strip is closed by the far heaps (a dim haze), not a bright gap under the lid.
  float Tfar = mix(lid, T, rise);
  vec3 lightFar = mix(skyHorizon * 0.5 * (1.0 - lid), mix(skyHorizon * 0.8 * (1.0 - T), light, far), rise);
  return vec4(lightFar, Tfar);
}

`;
