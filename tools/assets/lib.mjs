/** Shared steps of the asset tools (hull-cut, prop). */
/** Applies every node's world matrix to its mesh positions and normals, then resets the nodes. */
export const bake = (doc) => {
  // Apply every node's world matrix to its mesh positions/normals, then reset the nodes.
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const out = new Float32Array(pos.getCount() * 3);
      for (let i = 0; i < pos.getCount(); i++) {
        const [x, y, z] = pos.getElement(i, []);
        out[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
        out[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        out[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      pos.setArray(out);
      const nor = prim.getAttribute("NORMAL");
      if (nor) {
        const n = new Float32Array(nor.getCount() * 3);
        for (let i = 0; i < nor.getCount(); i++) {
          const [x, y, z] = nor.getElement(i, []);
          const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
          const l = Math.hypot(...v) || 1;
          n.set([v[0] / l, v[1] / l, v[2] / l], i * 3);
        }
        nor.setArray(n);
      }
    }
  }
  for (const node of doc.getRoot().listNodes()) node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
};

export const eachPrim = (doc, fn) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) fn(p);
};

/**
 * Principal axes of all vertices (PCA: power iteration on the covariance, deflated for the second
 * axis): { mean, axes: [long, middle, short] } as unit vectors, the third being their cross product.
 */
export const principalAxes = (doc) => {
  let n = 0;
  const mean = [0, 0, 0];
  eachPrim(doc, (p) => {
    const a = p.getAttribute("POSITION").getArray();
    for (let i = 0; i < a.length; i += 3) {
      for (let k = 0; k < 3; k++) mean[k] += a[i + k];
      n++;
    }
  });
  for (let k = 0; k < 3; k++) mean[k] /= n;
  const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  eachPrim(doc, (p) => {
    const a = p.getAttribute("POSITION").getArray();
    for (let i = 0; i < a.length; i += 3) {
      const d = [a[i] - mean[0], a[i + 1] - mean[1], a[i + 2] - mean[2]];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cov[r * 3 + c] += d[r] * d[c];
    }
  });
  const power = (m) => {
    let w = [1, 0.3, 0.2];
    let l = 1;
    for (let it = 0; it < 200; it++) {
      const v = [0, 1, 2].map((r) => m[r * 3] * w[0] + m[r * 3 + 1] * w[1] + m[r * 3 + 2] * w[2]);
      l = Math.hypot(...v);
      w = v.map((x) => x / l);
    }
    return [w, l];
  };
  const [w1, l1] = power(cov);
  const deflated = cov.map((v, i) => v - l1 * w1[Math.floor(i / 3)] * w1[i % 3]);
  const [w2] = power(deflated);
  const w3 = [w1[1] * w2[2] - w1[2] * w2[1], w1[2] * w2[0] - w1[0] * w2[2], w1[0] * w2[1] - w1[1] * w2[0]];
  return { mean, axes: [w1, w2, w3] };
};
