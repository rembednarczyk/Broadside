import { MAX_WAVES } from "@broadside/core";
import { WAKE_TRAIL } from "./wake-trail";

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
${WAKE_TRAIL}
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
    h -= 3.2 * (1.0 - smoothstep(0.62, 0.9, outline));
    float sq = min(speed * speed, 49.0);
    // Bow wave: a crest just ahead of the stem, spreading to the sides.
    float bow = exp(-pow((along - halfLen - 0.8) / (halfLen * 0.18 + 1.0), 2.0)) * exp(-pow(across / (halfBeam * 1.6), 2.0));
    h += 0.035 * sq * bow;
    // Water piled along the sides, strongest forward.
    float side = exp(-pow((abs(across) - halfBeam - 1.0) / 1.6, 2.0)) * smoothstep(-1.1, 0.6, u) * (1.0 - smoothstep(0.9, 1.3, u));
    h += 0.012 * sq * side;
    // Divergent bow wave: the sheet the stem turns aside runs off as a ridge on either bow, along
    // the Kelvin angle from the stem, highest at the bow and fading aft (the hull's own hollow hides
    // it where it would pass through the ship).
    float fromStem = halfLen - along;
    if (fromStem > 0.0) {
      float ridge = abs(abs(across) - (0.7 + fromStem * 0.354));
      h += 0.03 * sq * exp(-ridge * ridge / 1.6) * exp(-fromStem / (7.0 + speed * 5.0));
    }
    // Stern: a trough under the counter (the arms astern follow the track, below).
    float back = -(along + halfLen);
    if (back > 0.0) {
      h -= 0.015 * sq * exp(-back / 4.0) * exp(-across * across / (halfBeam * halfBeam));
    }
  }
  // The Kelvin arms along the course sailed (wake-trail), standing off the track as it ages.
  vec4 tr = trailAt(p);
  if (tr.y >= 0.0) {
    float run = tr.y * tr.z;
    float arm = abs(tr.x - (tr.w * 0.5 + run * 0.354));
    h += 0.02 * min(tr.z * tr.z, 49.0) * exp(-arm * arm / 2.5) * exp(-run / (8.0 + tr.z * 6.0));
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
uniform float sunGlint;
// Ships for wakes: (x, z, dirX, dirZ) and (speed, length, beam, 0); up to 8.
uniform vec4 shipA[8];
uniform vec4 shipB[8];
uniform int shipCount;
${WAKE_TRAIL}
uniform float underwater;
// Islands for shallows and surf: (x, z, radius, shoal); up to 32.
uniform vec4 islands[32];
uniform int islandCount;
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
// Foam is lace, not a blot: a network of bubble walls between rounded open cells, closing up to a
// solid sheet where it is thick. The walls are where the two nearest feature points of cellular
// noise are nearly equally near (F2 - F1 small, Worley 1996); \`cover\` 0..1 thickens them.
vec2 cells(vec2 p) {
  vec2 c = floor(p);
  float f1 = 9.0;
  float f2 = 9.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = c + vec2(float(i), float(j));
      vec2 r = o + vec2(hash(o), hash(o + 17.3)) - p;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  return sqrt(vec2(f1, f2));
}
float lace(vec2 p, float cover) {
  if (cover <= 0.01) return 0.0;
  // One evaluation of each cell field (nine hashed cells apiece): the compiler need not merge two calls.
  vec2 ca = cells(p);
  vec2 cb = cells(p * 2.7 + 5.1);
  float a = ca.y - ca.x;
  float b = cb.y - cb.x;
  float wall = min(a, b * 0.8);
  float w = 0.03 + cover * 0.55;
  return smoothstep(w, w - 0.06, wall) * smoothstep(0.0, 0.25, cover);
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
// Shallows and surf: water over a shoal turns pale and green (light from the sandy bottom), and
// waves break in a foam band at the shore (distance in island radii with the same coastline
// wobble as the terrain is approximated by noise).
vec2 shallows(vec2 p) {
  float shallow = 0.0;
  float surf = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= islandCount) break;
    vec4 is = islands[i];
    float d = length(p - is.xy);
    if (d > is.z * 1.4 + is.w + 60.0) continue;
    float wob = 0.75 + 0.5 * fbm(normalize(p - is.xy) * 1.8 + 5.0);
    float t = d / (is.z * wob);
    shallow = max(shallow, 1.0 - smoothstep(1.0, 1.0 + is.w / is.z, t));
    surf = max(surf, exp(-pow((t - 1.0) * is.z / 6.0, 2.0)));
  }
  return vec2(shallow, surf);
}

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
    ao *= mix(0.75, 1.0, smoothstep(0.95, 1.25, r));
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
    // Waterline foam: water churning against the hull all around its outline, more with speed.
    float u = along / halfLen;
    float w = across / (b.z * 0.5);
    float outline = u * u + w * w / max(0.05, 1.0 - max(0.0, u) * 0.6);
    foam += exp(-pow((outline - 1.0) / 0.12, 2.0)) * (0.35 + clamp(speed / 6.0, 0.0, 0.5));
    // Bow wave: a foam collar around the forward hull.
    float bow = smoothstep(b.z * 0.9, b.z * 0.4, across) * smoothstep(halfLen + 2.0, halfLen * 0.5, along) * step(0.0, along);
    foam += bow * clamp(speed / 6.0, 0.0, 1.0) * 0.5;
    // The bow wave breaks along its crest: foam on the ridge that runs off from the stem.
    float fromStem = halfLen - along;
    if (fromStem > 0.0) {
      float crest = smoothstep(1.5, 0.0, abs(across - (0.7 + fromStem * 0.354))) * exp(-fromStem / (5.0 + speed * 4.0));
      foam += crest * clamp((speed - 1.5) / 4.0, 0.0, 1.0) * 0.8;
    }
  }
  // Astern, along the course sailed (wake-trail): churned white water on the track for about
  // 25 s of sailing, and the Kelvin arms standing off it as it ages.
  vec4 tr = trailAt(p);
  if (tr.y >= 0.0) {
    float speed = tr.z;
    float run = tr.y * speed;
    float fade = exp(-tr.y / 25.0);
    float width = tr.w * 0.6 + run * 0.354;
    float centre = smoothstep(tr.w * 0.5 + run * 0.04, 0.0, tr.x) * fade;
    float arms = smoothstep(2.0, 0.0, abs(tr.x - width)) * fade * 0.3;
    foam += (centre * 0.45 + arms) * clamp(speed / 5.0, 0.0, 1.0);
    glit += (centre * 0.6 + arms) * fade;
  }
  return vec2(clamp(foam, 0.0, 1.0), clamp(glit, 0.0, 1.0));
}

// How bright white water is: lit by the key light (sun, or the moon at night: its colour carries
// its strength) and by the sky; at night under cloud foam is a dim grey, not a white.
float foamLight() {
  return 0.2 + 0.8 * clamp(dot(sunColor, vec3(0.3333)) * 0.9 + dot(skyHorizon, vec3(0.3333)) * 0.8, 0.0, 1.0);
}

vec3 underside(vec3 v, vec3 n, float dist) {
  // Seen from below: inside Snell's window (about 48.6 deg from the zenith, critical angle of
  // water) the sky shows through, bright and blurred; outside it total internal reflection
  // mirrors the dark depths.
  // up: the ray from the eye to the surface; its angle from the surface's (upward) normal.
  vec3 up = -v;
  float c = dot(up, n);
  // A soft edge: the waves tilt the surface, and a hard one breaks the window into black patches.
  float window = smoothstep(0.5, 0.82, c);
  // The sun through the window: a hard core and a broad blown-out glow round it (ref_161: the
  // disc is a quarter of the frame wide, white at its heart), the light scattered forward by the
  // water and the ripples of the surface.
  float toSun = max(dot(refract(up, -n, 1.33), sunDirection), 0.0);
  float sun = pow(toSun, 40.0) * 5.0 + pow(toSun, 6.0) * 1.6;
  // Less light comes through towards the window's rim (Fresnel transmission falls to nothing at
  // the critical angle), and the ripples of the surface show as brighter and darker streaks.
  float rim = mix(0.55, 1.0, smoothstep(0.66, 0.97, c));
  float ripple = 0.75 + 0.5 * clamp(0.5 + dot(n.xz, vec2(0.6, 0.8)) * 5.0, 0.0, 1.0);
  vec3 sky = mix(skyHorizon, skyZenith, 0.5) * 1.8 * rim * ripple + sunColor * sun;
  // Outside the window the depths, mirrored, with the waves' relief catching the light from the
  // window's side (the teal ripples round the bright disc in ref_161).
  float relief = 0.6 + 0.8 * clamp(dot(n.xz, normalize(sunDirection.xz + 1e-4)) * 4.0 + 0.3, 0.0, 1.0);
  vec3 deep = vec3(0.03, 0.14, 0.13) * relief;
  vec3 col = mix(deep, sky, window);
  return mix(col, vec3(0.02, 0.13, 0.12), 1.0 - exp(-0.035 * dist));
}

void main() {
  vec3 viewVec = cameraPosition - vWorld;
  float dist = length(viewVec);
  vec3 v = viewVec / dist;
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
  // From below the same surface, ripples and all (seen through it: Snell's window).
  if (underwater > 0.5) {
    gl_FragColor = vec4(underside(v, n, dist), 1.0);
    return;
  }
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
  col += sunColor * sunGlint * (spec + glitter * (1.0 - smoothstep(150.0, 900.0, dist) * 0.7));
  // Whitecaps: folding surface (Jacobian below 1) broken up by noise.
  float fold = clamp((1.0 - vFold) * 1.6 - 0.25, 0.0, 1.0);
  float foamNoise = fbm(vWorld.xz * 0.18 + vec2(time * 0.05, -time * 0.03));
  float caps = fold * foamAmount * smoothstep(0.45, 0.8, foamNoise + fold * 0.3);
  // The wake's and the crests' foam drawn as lace that drifts and opens as it ages.
  vec2 fp = vWorld.xz * 0.9 + vec2(time * 0.12, -time * 0.05);
  // Where a pixel spans more than the lace's cells (far off, or the isometric camera high up) the
  // pattern would alias into specks: it gives way to its average cover (the same filtering by
  // footprint as the glitter's normals).
  float laceFar = smoothstep(0.12, 0.5, foot);
  float capCover = clamp(caps * 1.2, 0.0, 1.0);
  // Past the far end of the blend only the average is seen: the cells are not computed there.
  float foam = (laceFar < 1.0 ? mix(lace(fp, capCover), capCover * 0.45, laceFar) : capCover * 0.45) * 0.75;
  // The wake's lace is finer than the crests' (churned water breaks into small bubbles) and lies
  // on a soft milky bed, so from a distance it reads as a streak of white, not a net of holes.
  float wakeCover = clamp(wk.x * 1.3, 0.0, 1.0);
  float wakeFar = smoothstep(0.05, 0.2, foot);
  float wakeLace = wakeFar < 1.0 ? mix(lace(fp * 2.6 + 3.7, wakeCover), wakeCover * 0.85, wakeFar) : wakeCover * 0.85;
  float wakeBed = wk.x * smoothstep(0.25, 0.75, fbm(fp * 0.8 + 11.0));
  foam = max(foam, max(wakeLace * (0.35 + 0.4 * wk.x), wakeBed * 0.55));
  col = mix(col, vec3(0.92, 0.95, 0.97) * foamLight(), foam);
  col *= hullOcclusion(vWorld.xz);
  vec2 sh = shallows(vWorld.xz);
  col = mix(col, mix(col, vec3(0.18, 0.32, 0.27), 0.7), sh.x * (1.0 - fresnel));
  float surfFoam = lace(vWorld.xz * 0.7 + vec2(time * 0.3, 0.0), clamp(sh.y * smoothstep(0.3, 0.7, fbm(vWorld.xz * 0.25 + vec2(time * 0.3, 0.0)) + sh.y * 0.3) * 1.3, 0.0, 1.0));
  col = mix(col, vec3(0.9, 0.92, 0.92) * foamLight(), surfFoam * 0.8);
  // Aerial perspective with in-scattering towards the sun: the haze glows where the sun is.
  float fog = 1.0 - exp(-fogDensity * dist);
  float towardSun = pow(max(dot(-v, sunDirection), 0.0), 6.0);
  col = mix(col, fogColor + sunColor * towardSun * 0.9, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;
