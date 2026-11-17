/**
 * Sky dome: gradient from horizon to zenith, sun disc with a Mie-like halo (Henyey-Greenstein
 * phase, g = 0.76) and two layers of procedural clouds (fbm value noise on a plane projected
 * from the view ray, as in Quilez's "clouds" articles), thicker and darker with cloud cover, and
 * two banks of cumulus heaps over the horizon (silhouettes in azimuth and elevation).
 */
export const SKY_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = worldViewProjection * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

/** Sky fragment shader with the cloud noise octaves of the graphics settings. */
/** Sky fragment shader with the cloud noise octaves of the graphics settings (5 and up: volumetric clouds). */
export const skyFragment = (octaves: number): string => /* glsl */ `
precision highp float;
#define VOLUMETRIC ${octaves >= 5 ? "true" : "false"}
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 skyZenith;
uniform vec3 skyHorizon;
uniform float cloudCover;
uniform float time;
uniform vec2 windOffset;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < ${octaves}; i++) { s += a * vnoise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return s;
}
// Billow noise (1 - |2n - 1|): puffy, rounded shapes, the usual cumulus primitive.
float billow(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < ${octaves}; i++) { s += a * (1.0 - abs(2.0 * vnoise(p) - 1.0)); p = p * 2.07 + vec2(1.3, 4.1); a *= 0.5; }
  return s;
}
float hg(float c, float g) { return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) / 12.566; }

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
  const int STEPS = ${octaves >= 6 ? 44 : 30};
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

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(skyHorizon, skyZenith, pow(h, 0.5));
  float c = dot(d, sunDirection);
  float sunUp = smoothstep(-0.1, 0.05, sunDirection.y);
  col += sunColor * hg(c, 0.76) * 0.5 * sunUp;
  col += sunColor * pow(max(c, 0.0), 40.0) * 1.2 * sunUp;
  col += sunColor * smoothstep(0.9993, 0.9997, c) * 8.0 * sunUp * (1.0 - cloudCover * 0.6);
  if (VOLUMETRIC) {
    vec4 clouds = marchClouds(d, sunUp);
    col = col * clouds.a + clouds.rgb;
  } else if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12);
    float n1 = mix(fbm(uv * 1.3 + windOffset * 0.002), billow(uv * 0.9 + windOffset * 0.0015), 0.6);
    float n2 = billow(uv * 2.6 - windOffset * 0.003 + 7.0);
    float density = smoothstep(0.5 - cloudCover * 0.45, 0.8 - cloudCover * 0.3, n1 * 0.8 + n2 * 0.45);
    // Thickness estimate from a second lookup towards the sun: thin edges glow (silver lining),
    // thick cores stay dark (a two-tap Beer-Lambert approximation).
    vec2 toSun = normalize(sunDirection.xz + 1e-4) * 0.08;
    float thick = mix(fbm(uv * 1.3 + toSun + windOffset * 0.002), billow(uv * 0.9 + toSun + windOffset * 0.0015), 0.6);
    float lightAmt = exp(-3.0 * max(0.0, thick - 0.35)) * sunUp;
    vec3 lit = mix(vec3(1.0, 0.97, 0.9), sunColor, 0.5) * (0.35 + 1.6 * lightAmt * pow(max(c, 0.0), 3.0) + 0.4 * lightAmt);
    // A storm sky is not a black lid: the cloud base is lit from all round by the day (a mid grey
    // of the horizon's tone), and its heaps shade one another: billows at a finer scale darken
    // the hollows and leave the swells lighter, which gives the deck its body.
    vec3 shade = mix(skyHorizon * 0.42, skyHorizon * 0.34 + vec3(0.02), cloudCover) * (0.55 + 0.4 * sunUp);
    float body = billow(uv * 4.3 + windOffset * 0.004 + 3.0);
    shade *= 0.62 + 0.75 * body;
    // Thin places let the sun through anywhere in the sky, most towards the sun.
    float glow = lightAmt * (1.0 - n2 * 0.8) * (0.55 + 0.9 * pow(max(c, 0.0), 2.0));
    vec3 cloud = mix(shade, lit, clamp(glow, 0.0, 1.0));
    col = mix(col, cloud, density * smoothstep(0.0, 0.12, d.y));
    // Low scud near the horizon: fast, dark, torn.
    float scud = smoothstep(0.55, 0.8, fbm(vec2(d.x / (d.y + 0.05) * 0.6, d.z / (d.y + 0.05) * 0.6) + windOffset * 0.006));
    col = mix(col, shade * 0.8, scud * cloudCover * smoothstep(0.25, 0.02, d.y) * 0.7);
  }
  // Cumulus banks over the horizon (towering heaps with flat dark bases and sunlit rims, as in the
  // reference). A projected cloud plane cannot show a base, so the banks are silhouettes in
  // azimuth and elevation: a top line from noise around the horizon circle (no seam at +-pi),
  // puffed by billow noise, over a flat base just above the haze.
  {
    float e = asin(clamp(d.y, -1.0, 1.0));
    vec2 ring = normalize(d.xz + 1e-5);
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      vec2 rp = ring * (2.2 + fk * 1.7) + vec2(fk * 11.0, fk * 5.0) + windOffset * 0.0004 * (1.0 + fk);
      float base = 0.012 + fk * 0.03;
      float tops = base + (0.04 + 0.2 * cloudCover) * smoothstep(0.35, 0.85, fbm(rp)) * (1.0 - fk * 0.35);
      float puff = billow(vec2(atan(ring.y, ring.x) * (14.0 + fk * 6.0), e * 26.0) + fk * 3.0 + windOffset * 0.001);
      float edge = tops + (puff - 0.5) * 0.05 - e;
      float bank = smoothstep(0.0, 0.012, edge) * smoothstep(base - 0.004, base + 0.01, e);
      if (bank > 0.0) {
        float up = clamp((e - base) / max(tops - base, 1e-3), 0.0, 1.0);
        // Dark at the base, lighter up the heap; the side towards the sun and the thin rims glow.
        float sunSide = pow(max(dot(ring, normalize(sunDirection.xz + 1e-5)), 0.0), 2.0);
        float rim = smoothstep(0.025, 0.0, edge) * (0.5 + 2.2 * sunSide) * sunUp;
        vec3 baseCol = mix(skyHorizon * 0.35, vec3(0.05), cloudCover * 0.6);
        vec3 topCol = mix(skyHorizon * 0.9, sunColor, 0.25 + 0.5 * sunSide) * (0.55 + 0.45 * sunUp);
        vec3 heap = mix(baseCol, topCol, pow(up, 0.7) * (0.6 + 0.4 * puff)) + sunColor * rim * 0.8;
        // Farther banks sink into the haze.
        col = mix(col, mix(heap, skyHorizon, 0.25 + fk * 0.35), bank * (0.95 - fk * 0.25));
      }
    }
  }
  // Haze over the horizon (aerial perspective of the sea air), brighter under the sun.
  {
    float e = asin(clamp(d.y, -1.0, 1.0));
    float toward = pow(max(dot(normalize(d.xz + 1e-5), normalize(sunDirection.xz + 1e-5)), 0.0), 3.0);
    vec3 haze = skyHorizon * (1.0 + 0.35 * toward * sunUp);
    col = mix(col, haze, smoothstep(0.09, 0.0, e) * (0.45 + 0.25 * toward));
  }
  // Overexposed core around the sun, through thin cloud (the reference's blown-out sky).
  col += sunColor * pow(max(c, 0.0), 5.0) * (VOLUMETRIC ? 0.55 : 1.6) * sunUp * (0.5 + 0.5 * cloudCover);
  gl_FragColor = vec4(col, 1.0);
}
`;
