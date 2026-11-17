/** Trails handed to the shader: the nearest ships, and points per trail (renderer/wake-trails.ts). */
export const TRAIL_SHIPS = 3;
export const TRAIL_POINTS = 16;

/**
 * GLSL of the wakes along the course sailed (renderer/wake-trails.ts records it), spliced into
 * both ocean shaders. `trailAt(p)` finds, over the nearest ships' trails, the closest point of
 * the polyline to p and returns (distance from it, age of the water there in seconds, the ship's
 * speed when she passed, her beam); age < 0: no wake here. A point beside or before the stern
 * (projecting past the newest end) is no part of the wake.
 * The wake drawn round it is a Kelvin wake in time instead of in distance astern: the white water
 * along the track and the two arms, which stand off it by 0.354 x the distance run since (tan
 * 19.47 deg) and fade over half a minute.
 */
export const WAKE_TRAIL = /* glsl */ `
uniform vec4 trail[${TRAIL_SHIPS * TRAIL_POINTS}];
uniform vec4 trailMeta[${TRAIL_SHIPS}];
uniform float trailReach[${TRAIL_SHIPS}];
uniform int trailCount;

vec4 trailAt(vec2 p) {
  vec4 best = vec4(1e9, -1.0, 0.0, 0.0);
  for (int k = 0; k < ${TRAIL_SHIPS}; k++) {
    if (k >= trailCount) break;
    vec4 m = trailMeta[k];
    if (length(p - m.zw) > trailReach[k]) continue;
    int n = int(m.x);
    for (int j = 0; j < ${TRAIL_POINTS - 1}; j++) {
      if (j + 1 >= n) break;
      vec4 a = trail[k * ${TRAIL_POINTS} + j];
      vec4 b = trail[k * ${TRAIL_POINTS} + j + 1];
      vec2 ab = b.xy - a.xy;
      float len2 = max(dot(ab, ab), 1e-4);
      float t = dot(p - a.xy, ab) / len2;
      if (j == 0 && t < 0.0) continue;
      t = clamp(t, 0.0, 1.0);
      float d = length(p - (a.xy + ab * t));
      if (d < best.x) best = vec4(d, mix(a.z, b.z, t), mix(a.w, b.w, t), m.y);
    }
  }
  return best;
}
`;
