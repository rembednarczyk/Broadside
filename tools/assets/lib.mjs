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
