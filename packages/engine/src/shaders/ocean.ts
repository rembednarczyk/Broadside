import { MAX_WAVES } from "@broadside/core";

/**
 * Ocean shader. The vertex stage evaluates the same Gerstner sum as `core/ocean/gerstner.ts`
 * (uniforms from `packWaves`), with analytic normals and a Jacobian-based crest term for foam
 * (Tessendorf 2001, sec. 4.4: whitecaps where the horizontal displacement folds the surface).
 * The fragment stage is a physically motivated water BRDF: Schlick Fresnel between the sky
 * reflection and a depth-tinted body colour, sun glint (normalised Blinn-Phong), a cheap
 * subsurface term on back-lit crests, procedural foam and aerial perspective to the horizon.
 */
export const OCEAN_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 viewProjection;
uniform vec2 gridOffset;
uniform float time;
uniform vec4 waveA[${MAX_WAVES}];
uniform vec4 waveB[${MAX_WAVES}];
uniform int waveCount;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFold;
varying float vHeight;

void main() {
  vec2 p0 = position.xz + gridOffset;
  vec3 p = vec3(p0.x, 0.0, p0.y);
  vec3 tx = vec3(1.0, 0.0, 0.0);
  vec3 tz = vec3(0.0, 0.0, 1.0);
  float jxx = 1.0; float jzz = 1.0; float jxz = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (i >= waveCount) break;
    vec4 a = waveA[i];
    vec4 b = waveB[i];
    vec2 d = a.xy;
    float k = a.z;
    float th = k * dot(d, p0) - a.w * time + b.z;
    float c = cos(th);
    float s = sin(th);
    p.x += b.y * d.x * c;
    p.z += b.y * d.y * c;
    p.y += b.x * s;
    // Partial derivatives of the displaced surface for the analytic normal.
    float qk = b.y * k;
    float ak = b.x * k;
    tx += vec3(-qk * d.x * d.x * s, ak * d.x * c, -qk * d.x * d.y * s);
    tz += vec3(-qk * d.x * d.y * s, ak * d.y * c, -qk * d.y * d.y * s);
    jxx -= qk * d.x * d.x * s;
    jzz -= qk * d.y * d.y * s;
    jxz -= qk * d.x * d.y * s;
  }
  vNormal = normalize(cross(tz, tx));
  vFold = jxx * jzz - jxz * jxz;
  vHeight = p.y;
  vWorld = p;
  gl_Position = viewProjection * vec4(p, 1.0);
}
`;

export const OCEAN_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 cameraPosition;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 skyZenith;
uniform vec3 skyHorizon;
uniform vec3 waterDeep;
uniform vec3 waterShallow;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float time;
uniform float foamAmount;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFold;
varying float vHeight;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}

vec3 skyColor(vec3 dir) {
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 sky = mix(skyHorizon, skyZenith, pow(h, 0.45));
  float sun = max(dot(dir, sunDirection), 0.0);
  sky += sunColor * (pow(sun, 8.0) * 0.25 + pow(sun, 900.0) * 6.0);
  return sky;
}

void main() {
  vec3 viewVec = cameraPosition - vWorld;
  float dist = length(viewVec);
  vec3 v = viewVec / dist;
  // Small ripples from noise, faded with distance to avoid shimmering.
  float ripple = (1.0 - smoothstep(20.0, 160.0, dist)) * 0.07;
  vec2 rp = vWorld.xz * 0.22 + vec2(time * 0.3, time * 0.18);
  vec3 n = normalize(vNormal + ripple * vec3(fbm(rp) - 0.5, 0.0, fbm(rp + 5.2) - 0.5));
  float nv = clamp(dot(n, v), 0.0, 1.0);
  // Schlick Fresnel, F0 of water = 0.02.
  float fresnel = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  vec3 reflection = skyColor(r);
  // Body colour: shallower look on crests, deeper in troughs.
  float crest = clamp(vHeight * 0.35 + 0.5, 0.0, 1.0);
  vec3 body = mix(waterDeep, waterShallow, crest * 0.6);
  // Subsurface glow where the sun shines through a crest towards the viewer.
  float sss = pow(clamp(dot(v, -sunDirection) * 0.5 + 0.5, 0.0, 1.0), 4.0) * crest;
  body += waterShallow * sss * 0.6 * sunColor;
  vec3 col = mix(body * (0.35 + 0.65 * max(sunDirection.y, 0.0)), reflection * 0.8, fresnel);
  // Sun glint: normalised Blinn-Phong on the wave normal, plus a glitter path: many tiny facets
  // from high-frequency noise normals, each a sharp highlight (a cheap stochastic-glint model in
  // the spirit of Zirr and Kaplanyan's real-time glints). Values above 1 feed the bloom.
  vec3 h = normalize(sunDirection + v);
  float spec = pow(max(dot(n, h), 0.0), 600.0) * 60.0 * fresnel;
  vec2 gp = vWorld.xz * 2.3 + vec2(time * 0.9, time * 0.6);
  vec3 gn = normalize(n + 0.55 * vec3(vnoise(gp) - 0.5, 0.0, vnoise(gp + 17.3) - 0.5) + 0.35 * vec3(vnoise(gp * 3.1) - 0.5, 0.0, vnoise(gp * 3.1 + 5.1) - 0.5));
  float glitter = pow(max(dot(gn, h), 0.0), 3500.0) * 90.0 * smoothstep(-0.05, 0.25, sunDirection.y);
  col += sunColor * (spec + glitter * (1.0 - smoothstep(150.0, 900.0, dist) * 0.7));
  // Whitecaps: folding surface (Jacobian below 1) broken up by noise.
  float fold = clamp((1.0 - vFold) * 1.6 - 0.25, 0.0, 1.0);
  float foamNoise = fbm(vWorld.xz * 0.18 + vec2(time * 0.05, -time * 0.03));
  float foam = clamp(fold * foamAmount * smoothstep(0.35, 0.75, foamNoise + fold * 0.4), 0.0, 1.0);
  col = mix(col, vec3(0.92, 0.95, 0.97) * (0.55 + 0.45 * max(sunDirection.y, 0.1)), foam);
  // Aerial perspective with in-scattering towards the sun: the haze glows where the sun is.
  float fog = 1.0 - exp(-fogDensity * dist);
  float towardSun = pow(max(dot(-v, sunDirection), 0.0), 6.0);
  col = mix(col, fogColor + sunColor * towardSun * 0.9, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;
