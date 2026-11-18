/**
 * GLSL of the course on the water (renderer/course-view.ts): light laid on the sea. uv.x is
 * metres along the line, uv.y 0 to 1 across. A bright core and soft edges (a gaussian across the
 * strip), pulses running along it (`flow` +1: from the ship onwards, -1: back towards where the
 * finger started), and glints that wink on and off in cells along the line like sun on foam (a
 * hashed cell lit for a moment, Perlin's lattice hash). `glow` above 1 feeds the bloom.
 */
export const COURSE_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main() {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

export const COURSE_FRAGMENT = /* glsl */ `
precision highp float;
uniform float time;
uniform vec3 colour;
uniform float glow;
uniform float flow;
varying vec2 vUV;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float across = vUV.y * 2.0 - 1.0;
  float core = exp(-across * across * 9.0);
  float body = 1.0 - smoothstep(0.55, 1.0, abs(across));
  // Pulses running along the line, a few metres apart.
  float pulse = 0.5 + 0.5 * sin(vUV.x * 0.55 - flow * time * 7.0);
  pulse = pulse * pulse;
  // Glints: cells along the line, each lit for a moment now and then.
  vec2 cell = floor(vec2(vUV.x * 0.8, vUV.y * 4.0));
  float blink = step(0.93, hash(cell + floor(time * 6.0 + hash(cell) * 6.0)));
  float a = (body * 0.35 + core * 0.55) * (0.55 + 0.45 * pulse) + blink * body * 0.5;
  vec3 c = mix(colour, vec3(1.0), core * 0.6) * (0.8 + 0.6 * pulse);
  gl_FragColor = vec4(c * max(glow, 0.0), clamp(a * min(glow, 1.0), 0.0, 1.0));
}
`;
