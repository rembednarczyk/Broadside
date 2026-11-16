/**
 * Sky dome: gradient from horizon to zenith, sun disc with a Mie-like halo (Henyey-Greenstein
 * phase, g = 0.76) and two layers of procedural clouds (fbm value noise on a plane projected
 * from the view ray, as in Quilez's "clouds" articles), thicker and darker with cloud cover.
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

export const SKY_FRAGMENT = /* glsl */ `
precision highp float;
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
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return s;
}
float hg(float c, float g) { return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) / 12.566; }

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(skyHorizon, skyZenith, pow(h, 0.5));
  float c = dot(d, sunDirection);
  float sunUp = smoothstep(-0.1, 0.05, sunDirection.y);
  col += sunColor * hg(c, 0.76) * 0.5 * sunUp;
  col += sunColor * pow(max(c, 0.0), 40.0) * 1.2 * sunUp;
  col += sunColor * smoothstep(0.9993, 0.9997, c) * 8.0 * sunUp * (1.0 - cloudCover * 0.6);
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12);
    float n1 = fbm(uv * 1.3 + windOffset * 0.002);
    float n2 = fbm(uv * 3.1 - windOffset * 0.003 + 7.0);
    float density = smoothstep(0.55 - cloudCover * 0.5, 0.85 - cloudCover * 0.3, n1 * 0.75 + n2 * 0.45);
    // Thickness estimate from a second lookup towards the sun: thin edges glow (silver lining),
    // thick cores stay dark (a two-tap Beer-Lambert approximation).
    vec2 toSun = normalize(sunDirection.xz + 1e-4) * 0.08;
    float thick = fbm(uv * 1.3 + toSun + windOffset * 0.002);
    float lightAmt = exp(-3.0 * max(0.0, thick - 0.35)) * sunUp;
    vec3 lit = mix(vec3(1.0, 0.97, 0.9), sunColor, 0.5) * (0.35 + 1.6 * lightAmt * pow(max(c, 0.0), 3.0) + 0.4 * lightAmt);
    vec3 shade = mix(skyHorizon * 0.45, vec3(0.1, 0.1, 0.11), cloudCover);
    vec3 cloud = mix(shade, lit, clamp(lightAmt * (1.0 - n2 * 0.8) * (0.4 + 0.9 * pow(max(c, 0.0), 2.0)), 0.0, 1.0));
    col = mix(col, cloud, density * smoothstep(0.0, 0.12, d.y));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
