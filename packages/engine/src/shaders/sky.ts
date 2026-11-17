import { volumetricClouds } from "./sky-clouds";

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

${volumetricClouds(octaves >= 6 ? 72 : 56)}
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(skyHorizon, skyZenith, pow(h, 0.5));
  float c = dot(d, sunDirection);
  float sunUp = smoothstep(-0.1, 0.05, sunDirection.y);
  col += sunColor * hg(c, 0.76) * 0.5 * sunUp;
  col += sunColor * pow(max(c, 0.0), 40.0) * 1.2 * sunUp;
  col += sunColor * smoothstep(0.9993, 0.9997, c) * 8.0 * sunUp * (1.0 - cloudCover * 0.6);
  // How much of the sky behind shows through the volumetric clouds.
  float through = 1.0;
  if (VOLUMETRIC) {
    vec4 clouds = marchClouds(d, sunUp);
    col = col * clouds.a + clouds.rgb;
    through = clouds.a;
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
  if (!VOLUMETRIC) {
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
  col += sunColor * pow(max(c, 0.0), 5.0) * (VOLUMETRIC ? 0.55 * (0.15 + 0.85 * through) : 1.6) * sunUp * (0.5 + 0.5 * cloudCover);
  gl_FragColor = vec4(col, 1.0);
}
`;
