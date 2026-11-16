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
// Visual-only short waves (graphics detail; the simulation does not see them, their height is
// centimetres): same Gerstner form, same layout.
uniform vec4 detailA[8];
uniform vec4 detailB[8];
uniform int detailCount;
uniform vec4 shipA[8];
uniform vec4 shipB[8];
uniform int shipCount;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFold;
varying float vHeight;

// Hull-water interaction on the surface (visual): each ship pushes up a bow wave growing with
// the square of its speed (wave-making, cf. Froude scaling), piles water along its sides, holds
// the sea below its keel inside the hull outline (so the hull cuts the water and no crest shows
// through the deck), and leaves Kelvin-wedge ridges astern. Data: (x, z, dirX, dirZ) and
// (speed, length, beam, 0) per ship.
float hullWater(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= shipCount) break;
    vec4 a = shipA[i];
    vec4 b = shipB[i];
    vec2 d = p - a.xy;
    float along = dot(d, a.zw);
    float across = d.x * a.w - d.y * a.z;
    float halfLen = b.y * 0.5;
    float halfBeam = b.z * 0.5;
    float speed = b.x;
    float u = along / halfLen;
    float w = across / halfBeam;
    // Inside the waterline outline (an ellipse narrowing to the bow): keep the sea under the hull.
    float outline = u * u + w * w / max(0.05, 1.0 - max(0.0, u) * 0.6);
    h -= 2.5 * (1.0 - smoothstep(0.45, 0.7, outline));
    float sq = min(speed * speed, 49.0);
    // Bow wave: a crest just ahead of the stem, spreading to the sides.
    float bow = exp(-pow((along - halfLen - 0.8) / (halfLen * 0.18 + 1.0), 2.0)) * exp(-pow(across / (halfBeam * 1.6), 2.0));
    h += 0.035 * sq * bow;
    // Water piled along the sides, strongest forward.
    float side = exp(-pow((abs(across) - halfBeam - 1.0) / 1.6, 2.0)) * smoothstep(-1.1, 0.6, u) * (1.0 - smoothstep(0.9, 1.3, u));
    h += 0.012 * sq * side;
    // Stern: a trough under the counter, then the Kelvin arms (half-angle 19.47 deg) fading astern.
    float back = -(along + halfLen);
    if (back > 0.0) {
      float fade = exp(-back / (8.0 + speed * 6.0));
      float arm = abs(abs(across) - (halfBeam + back * 0.354));
      h += 0.02 * sq * exp(-arm * arm / 2.5) * fade;
      h -= 0.015 * sq * exp(-back / 4.0) * exp(-across * across / (halfBeam * halfBeam));
    }
  }
  return h;
}

void gerstner(vec4 a, vec4 b, vec2 p0, inout vec3 p, inout vec3 tx, inout vec3 tz, inout float jxx, inout float jzz, inout float jxz) {
  vec2 d = a.xy;
  float k = a.z;
  float th = k * dot(d, p0) - a.w * time + b.z;
  float c = cos(th);
  float s = sin(th);
  p.x += b.y * d.x * c;
  p.z += b.y * d.y * c;
  p.y += b.x * s;
  float qk = b.y * k;
  float ak = b.x * k;
  tx += vec3(-qk * d.x * d.x * s, ak * d.x * c, -qk * d.x * d.y * s);
  tz += vec3(-qk * d.x * d.y * s, ak * d.y * c, -qk * d.y * d.y * s);
  jxx -= qk * d.x * d.x * s;
  jzz -= qk * d.y * d.y * s;
  jxz -= qk * d.x * d.y * s;
}

void main() {
  vec2 p0 = position.xz + gridOffset;
  vec3 p = vec3(p0.x, 0.0, p0.y);
  vec3 tx = vec3(1.0, 0.0, 0.0);
  vec3 tz = vec3(0.0, 0.0, 1.0);
  float jxx = 1.0; float jzz = 1.0; float jxz = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (i >= waveCount) break;
    gerstner(waveA[i], waveB[i], p0, p, tx, tz, jxx, jzz, jxz);
  }
  for (int i = 0; i < 8; i++) {
    if (i >= detailCount) break;
    gerstner(detailA[i], detailB[i], p0, p, tx, tz, jxx, jzz, jxz);
  }
  // Ships: displacement and its slope (finite differences) folded into the normal.
  float hw = hullWater(p.xz);
  if (shipCount > 0) {
    float hx = hullWater(p.xz + vec2(0.4, 0.0));
    float hz = hullWater(p.xz + vec2(0.0, 0.4));
    tx.y += (hx - hw) / 0.4;
    tz.y += (hz - hw) / 0.4;
    p.y += hw;
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
precision highp int;
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
// Ships for wakes: (x, z, dirX, dirZ) and (speed, length, beam, 0); up to 8.
uniform vec4 shipA[8];
uniform vec4 shipB[8];
uniform int shipCount;
uniform float underwater;
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

// Wake of the ships: a Kelvin wedge (half-angle 19.47 deg) behind each stern, turbulent foam
// along the centre that fades with distance, a bow wave ring at the stem. Returns (foam, glitter).
// Contact shading: the hull shades and occludes the water along its sides (ambient occlusion
// of the hull on the sea), so a ship sits in the water instead of on it.
float hullOcclusion(vec2 p) {
  float ao = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= shipCount) break;
    vec4 a = shipA[i];
    vec4 b = shipB[i];
    vec2 d = p - a.xy;
    float along = dot(d, a.zw) / (b.y * 0.55);
    float across = abs(d.x * a.w - d.y * a.z) / (b.z * 0.5);
    float r = length(vec2(along, across));
    ao *= mix(0.45, 1.0, smoothstep(0.85, 1.6, r));
  }
  return ao;
}

vec2 wakes(vec2 p) {
  float foam = 0.0;
  float glit = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= shipCount) break;
    vec4 a = shipA[i];
    vec4 b = shipB[i];
    vec2 d = p - a.xy;
    float along = dot(d, a.zw);
    float across = abs(d.x * a.w - d.y * a.z);
    float halfLen = b.y * 0.5;
    float speed = b.x;
    // Bow wave: a foam collar around the forward hull.
    float bow = smoothstep(b.z * 0.9, b.z * 0.4, across) * smoothstep(halfLen + 2.0, halfLen * 0.5, along) * step(0.0, along);
    foam += bow * clamp(speed / 6.0, 0.0, 1.0) * 0.5;
    // Behind the stern.
    float back = -(along + halfLen);
    if (back > 0.0) {
      float len = speed * 12.0;
      float fade = exp(-back / max(len, 1.0));
      float width = b.z * 0.6 + back * 0.354;
      float centre = smoothstep(b.z * 0.5 + back * 0.04, 0.0, across) * fade;
      float arms = smoothstep(2.0, 0.0, abs(across - width)) * fade * 0.3;
      foam += (centre * 0.45 + arms) * clamp(speed / 5.0, 0.0, 1.0);
      glit += (centre * 0.6 + arms) * fade;
    }
  }
  return vec2(clamp(foam, 0.0, 1.0), clamp(glit, 0.0, 1.0));
}

vec3 underside(vec3 v, vec3 n, float dist) {
  // Seen from below: inside Snell's window (about 48.6 deg from the zenith, critical angle of
  // water) the sky shows through, bright and blurred; outside it total internal reflection
  // mirrors the dark depths.
  vec3 up = -v;
  float c = dot(up, -n);
  float window = smoothstep(0.62, 0.7, c);
  float sun = pow(max(dot(refract(up, -n, 1.33), sunDirection), 0.0), 40.0);
  vec3 sky = mix(skyHorizon, skyZenith, 0.5) * 1.6 + sunColor * sun * 4.0;
  vec3 deep = vec3(0.02, 0.1, 0.1);
  vec3 col = mix(deep, sky, window);
  return mix(col, vec3(0.02, 0.13, 0.12), 1.0 - exp(-0.035 * dist));
}

void main() {
  vec3 viewVec = cameraPosition - vWorld;
  float dist = length(viewVec);
  vec3 v = viewVec / dist;
  if (underwater > 0.5) {
    gl_FragColor = vec4(underside(v, vNormal, dist), 1.0);
    return;
  }
  // Micro-surface: wind chop as normal detail from two scales of fbm (finite differences),
  // scrolling downwind. Faded by screen-space footprint (fwidth) so it never shimmers: the
  // detail fades where one pixel covers more than a ripple.
  vec2 wind = vec2(0.9, 0.5);
  vec2 q1 = vWorld.xz * 0.7 + wind * time * 0.35;
  vec2 q2 = vWorld.xz * 2.4 - wind.yx * time * 0.6;
  float e = 0.15;
  float a0 = fbm(q1); float ax = fbm(q1 + vec2(e, 0.0)); float az = fbm(q1 + vec2(0.0, e));
  float b0 = fbm(q2); float bx = fbm(q2 + vec2(e, 0.0)); float bz = fbm(q2 + vec2(0.0, e));
  vec2 q0 = vWorld.xz * 0.22 + wind * time * 0.25;
  float c0 = fbm(q0); float cx = fbm(q0 + vec2(e, 0.0)); float cz = fbm(q0 + vec2(0.0, e));
  float foot = length(fwidth(vWorld.xz));
  float detail0 = (1.0 - smoothstep(2.0, 9.0, foot)) * 0.9;
  float detail1 = (1.0 - smoothstep(0.6, 3.0, foot)) * 0.55;
  float detail2 = (1.0 - smoothstep(0.15, 0.9, foot)) * 0.35;
  vec3 dn = vec3(-(cx - c0) / e * detail0 - (ax - a0) / e * detail1 - (bx - b0) / e * detail2, 0.0, -(cz - c0) / e * detail0 - (az - a0) / e * detail1 - (bz - b0) / e * detail2);
  vec3 n = normalize(vNormal + dn * 0.5);
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
  vec3 col = mix(body * (0.35 + 0.65 * max(sunDirection.y, 0.0)), reflection * 0.45, fresnel);
  // Sun glint: normalised Blinn-Phong on the wave normal, plus a glitter path: many tiny facets
  // from high-frequency noise normals, each a sharp highlight (a cheap stochastic-glint model in
  // the spirit of Zirr and Kaplanyan's real-time glints). Values above 1 feed the bloom.
  vec3 h = normalize(sunDirection + v);
  float spec = pow(max(dot(n, h), 0.0), 600.0) * 60.0 * fresnel;
  vec2 gp = vWorld.xz * 6.0 + vec2(time * 1.4, time * 0.9);
  float gfade = 1.0 - smoothstep(0.05, 0.4, foot * 6.0);
  vec3 gn = normalize(n + gfade * (0.5 * vec3(vnoise(gp) - 0.5, 0.0, vnoise(gp + 17.3) - 0.5) + 0.4 * vec3(vnoise(gp * 2.7) - 0.5, 0.0, vnoise(gp * 2.7 + 5.1) - 0.5)));
  vec2 wk = wakes(vWorld.xz);
  float glitter = pow(max(dot(gn, h), 0.0), 5000.0 - wk.y * 2500.0) * (70.0 + wk.y * 50.0) * smoothstep(-0.05, 0.25, sunDirection.y);
  col += sunColor * (spec + glitter * (1.0 - smoothstep(150.0, 900.0, dist) * 0.7));
  // Whitecaps: folding surface (Jacobian below 1) broken up by noise.
  float fold = clamp((1.0 - vFold) * 1.6 - 0.25, 0.0, 1.0);
  float foamNoise = fbm(vWorld.xz * 0.18 + vec2(time * 0.05, -time * 0.03));
  float foam = clamp(fold * foamAmount * 0.6 * smoothstep(0.5, 0.85, foamNoise + fold * 0.3), 0.0, 1.0);
  float wakeFoam = wk.x * smoothstep(0.45, 0.75, fbm(vWorld.xz * 0.6 + vec2(time * 0.2, 0.0)) + wk.x * 0.2);
  foam = max(foam, wakeFoam * 0.5);
  col = mix(col, vec3(0.92, 0.95, 0.97) * (0.55 + 0.45 * max(sunDirection.y, 0.1)), foam);
  col *= hullOcclusion(vWorld.xz);
  // Aerial perspective with in-scattering towards the sun: the haze glows where the sun is.
  float fog = 1.0 - exp(-fogDensity * dist);
  float towardSun = pow(max(dot(-v, sunDirection), 0.0), 6.0);
  col = mix(col, fogColor + sunColor * towardSun * 0.9, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;
