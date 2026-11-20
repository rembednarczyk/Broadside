import { type AbstractMesh, DynamicTexture, Mesh, Ray, type Scene, StandardMaterial, type TransformNode, Vector3, VertexData } from "../babylon";

/**
 * Shot holes in a hull where the balls went in (M11; the battered sides of Black Flag's ships):
 * decals (Lengyel's decal projection, "Game Programming Gems 2", reduced to a quad laid on the
 * surface) found by casting a ray at the hull from outside at the height and station of the hit,
 * and laid on the surface the ray meets, facing out along its normal. One mesh of quads per ship,
 * rebuilt at each hit, under the ship's hull node so they ride with her (thin instances under that
 * node did not draw, 19.11). The oldest hole gives way when
 * a ship has `MAX` (a hull shot to pieces looks the same with more). The hole is a dark, ragged
 * mouth ringed with the pale splintered wood of fresh breaks, drawn once per scene.
 */
const MAX = 40;

const holeTexture = (scene: Scene): DynamicTexture => {
  const size = 128;
  const t = new DynamicTexture("shot-hole", { width: size, height: size }, scene, true);
  const ctx = t.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  let s = 7;
  const rnd = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  // Splinters: pale spikes of torn wood out from the hole.
  ctx.fillStyle = "rgba(232,200,150,1)";
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const r1 = c * (0.7 + rnd() * 0.3);
    const w = 0.1 + rnd() * 0.12;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a - w) * c * 0.3, c + Math.sin(a - w) * c * 0.3);
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    ctx.lineTo(c + Math.cos(a + w) * c * 0.3, c + Math.sin(a + w) * c * 0.3);
    ctx.fill();
  }
  // The mouth: ragged and black inside, scorched brown at the lip.
  const ring = (radius: number, colour: string): void => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = radius * (0.8 + rnd() * 0.35);
      if (i === 0) ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      else ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.fill();
  };
  ring(c * 0.58, "rgba(70,46,28,1)");
  ring(c * 0.42, "rgba(8,6,5,1)");
  t.hasAlpha = true;
  t.update();
  return t;
};

/**
 * Scorching (M11): a blotch of soot where fire has burnt the side or the timbers are shot to
 * pieces, ragged at its rim (overlapping soft discs cut by the alpha test), darkest at its heart.
 */
const scorchTexture = (scene: Scene): DynamicTexture => {
  const size = 128;
  const t = new DynamicTexture("hull-scorch", { width: size, height: size }, scene, true);
  const ctx = t.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  let s = 11;
  const rnd = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * size * 0.28;
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r * 0.7;
    const rad = size * (0.1 + rnd() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(14,10,8,0.95)");
    g.addColorStop(0.6, "rgba(30,22,16,0.7)");
    g.addColorStop(1, "rgba(40,30,22,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  t.hasAlpha = true;
  t.update();
  return t;
};

const holeMaterial = (scene: Scene, kind: "hole" | "scorch"): StandardMaterial => {
  const name = kind === "hole" ? "shot-hole" : "hull-scorch";
  const cached = scene.getMaterialByName(name);
  if (cached) return cached as StandardMaterial;
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = kind === "hole" ? holeTexture(scene) : scorchTexture(scene);
  m.useAlphaFromDiffuseTexture = true;
  // Babylon's Material.MATERIAL_ALPHATEST: cut out, no sorting.
  m.transparencyMode = 1;
  m.alphaCutOff = 0.4;
  m.specularColor.set(0.02, 0.02, 0.02);
  m.zOffset = -2;
  m.backFaceCulling = false;
  return m;
};

export class ShotHoles {
  private readonly mesh: Mesh;
  /** The holes in the hull's frame: centre, outward normal, size and twist. */
  private readonly holes: { p: Vector3; n: Vector3; size: number; twist: number }[] = [];

  /** `hull`: the meshes the holes are laid on (the hull model, or the generated hull). */
  /** `kind`: shot holes, or scorching (the same decals with a blotch of soot). */
  constructor(scene: Scene, private readonly parent: TransformNode, private readonly hull: () => readonly AbstractMesh[], private readonly beam: number, kind: "hole" | "scorch" = "hole") {
    this.mesh = new Mesh(`${kind === "hole" ? "shot-holes" : "scorch"}-${parent.name}`, scene);
    this.mesh.parent = parent;
    this.mesh.material = holeMaterial(scene, kind);
    this.mesh.isPickable = false;
  }

  /** A ball went in at this world point (`size`: the hole's width, m). Returns whether a hole was laid. */
  add(at: { readonly x: number; readonly y: number; readonly z: number }, size: number): boolean {
    const world = this.parent.computeWorldMatrix(true);
    const inv = world.clone().invert();
    const local = Vector3.TransformCoordinates(new Vector3(at.x, at.y, at.z), inv);
    const side = local.x >= 0 ? 1 : -1;
    // From outside the side, square in towards the centreline, at the height and station of the hit.
    const origin = Vector3.TransformCoordinates(new Vector3(side * this.beam, local.y, local.z), world);
    const dir = Vector3.TransformNormal(new Vector3(-side, 0, 0), world).normalize();
    const ray = new Ray(origin, dir, this.beam * 3);
    // The scene's picking (it handles the hull node's scale): the nearest face of the hull's meshes.
    // Both tiers of a modelled hull may be asked (the one hidden by the level of detail has a stale world matrix).
    const hull = new Set(this.hull());
    for (const m of hull) m.computeWorldMatrix(true);
    const hit = this.parent.getScene().pickWithRay(ray, (m) => hull.has(m), false);
    const normal = hit?.hit ? hit.getNormal(true, true) : null;
    const best = hit?.hit && hit.pickedPoint && normal ? { point: hit.pickedPoint, normal } : null;
    if (!best) return false;
    const p = Vector3.TransformCoordinates(best.point, inv);
    let n = Vector3.TransformNormal(best.normal, inv).normalize();
    if (n.x * side < 0) n = n.scale(-1);
    if (this.holes.length >= MAX) this.holes.shift();
    this.holes.push({ p: p.add(n.scale(0.03)), n, size, twist: (Math.abs(p.y * 7.3 + p.z * 3.1) % 1) * Math.PI * 2 });
    this.rebuild();
    return true;
  }

  /** One quad per hole in the hull's frame, facing out along its normal with its own twist. */
  private rebuild(): void {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (const h of this.holes) {
      // Two axes across the surface: one roughly along the waterline, the other up it, turned by the twist.
      const t0 = Vector3.Cross(Vector3.Up(), h.n);
      const along = t0.lengthSquared() > 1e-6 ? t0.normalize() : new Vector3(0, 0, 1);
      const up = Vector3.Cross(h.n, along).normalize();
      const c = Math.cos(h.twist);
      const s = Math.sin(h.twist);
      const u = along.scale(c).add(up.scale(s)).scale(h.size / 2);
      const v = up.scale(c).subtract(along.scale(s)).scale(h.size / 2);
      const base = positions.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const q = h.p.add(u.scale(a)).add(v.scale(b));
        positions.push(q.x, q.y, q.z);
        normals.push(h.n.x, h.n.y, h.n.z);
        uvs.push((a + 1) / 2, (b + 1) / 2);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.uvs = uvs;
    data.indices = indices;
    data.applyToMesh(this.mesh, true);
    // A mesh that has not been drawn keeps the world matrix it was made with: brought up to date here.
    this.mesh.computeWorldMatrix(true);
  }

  dispose(): void {
    this.mesh.dispose();
  }

  get count(): number {
    return this.holes.length;
  }
}
