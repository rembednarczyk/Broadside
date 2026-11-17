/**
 * Skeleton maths shared by the crew bake (crew-anim.mjs) and the retargeting of Mixamo clips
 * (retarget.mjs): 4x4 matrices column-major as in glTF, quaternions [x, y, z, w], world matrices of
 * a glTF document's nodes in a pose.
 */
// --- 4x4 matrices, column-major as in glTF ---
export const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
export const trs = (t, q, s) => {
  const [x, y, z, w] = q;
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
};
export const apply = (m, v, w) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * w);
/** Inverse of an affine matrix (rotation and scale, then translation). */
export const invert = (m) => {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const r = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const it = [0, 1, 2].map((k) => -(r[k * 3] * t[0] + r[k * 3 + 1] * t[1] + r[k * 3 + 2] * t[2]));
  return [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, it[0], it[1], it[2], 1];
};

/** Sample of an animation sampler at time t (linear; quaternions normalised, on the short arc). */
export const sample = (s, t, size) => {
  const times = s.getInput().getArray();
  const vals = s.getOutput().getArray();
  let i = 0;
  while (i + 1 < times.length && times[i + 1] <= t) i++;
  const j = Math.min(times.length - 1, i + 1);
  const f = j === i ? 0 : Math.max(0, Math.min(1, (t - times[i]) / (times[j] - times[i])));
  const a = [...vals.slice(i * size, i * size + size)];
  const b = [...vals.slice(j * size, j * size + size)];
  if (size === 4 && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) for (let k = 0; k < 4; k++) b[k] = -b[k];
  const v = a.map((x, k) => x + (b[k] - x) * f);
  if (size !== 4) return v;
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};

/** World matrix of every node of a document, with a pose (rotation and translation by node name). */
export const worldOf = (doc, pose = { rot: new Map(), pos: new Map() }) => {
  const byName = new Map();
  const visit = (node, parent) => {
    const name = node.getName();
    const m = mul(parent, trs(pose.pos.get(name) ?? node.getTranslation(), pose.rot.get(name) ?? node.getRotation(), node.getScale()));
    byName.set(name, m);
    for (const child of node.listChildren()) visit(child, m);
  };
  const identity = trs([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) visit(node, identity);
  return byName;
};
