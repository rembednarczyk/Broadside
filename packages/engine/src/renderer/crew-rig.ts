import { BakedVertexAnimationManager, Bone, Matrix, Mesh, RawTexture, type Scene, Skeleton, StandardMaterial, Texture, VertexBuffer, VertexData } from "../babylon";
import { assetUrl } from "./asset-url";
import { type CrewClipName } from "./crew-roles";
import { type CrewFile, parseCrewFile } from "./crew-file";

/**
 * The animated crew (tools/assets/crew-anim.mjs), loaded once and shared by all ships
 * (Prototype): one skinned mesh per figure, one texture of joint matrices for every clip, played
 * per thin instance by Babylon's BakedVertexAnimationManager (vertex animation textures, the
 * technique of "Animating Crowds" in GPU Gems 3 ch. 2: skinning matrices read from a texture, an
 * animation and a phase per instance). The meshes need a skeleton for Babylon to compile skinning
 * in; its bones stay at rest, the texture supplies the matrices.
 */
export interface ClipRange {
  readonly from: number;
  readonly to: number;
  readonly fps: number;
  readonly frames: number;
  readonly seconds: number;
  /** Travel of a climbing clip (crew-aloft); 0 for the others. */
  readonly rise: number;
  readonly advance: number;
  readonly reach: number;
}

export class CrewRig {
  private meshes: Mesh[] | null = null;
  private manager: BakedVertexAnimationManager | null = null;
  private readonly clips = new Map<string, ClipRange>();
  /**
   * Per figure (as templates) the lengths of its two index ranges, one after the other in its
   * index buffer: the full figure and the far level of detail over the same vertices.
   */
  readonly levels: { near: number; far: number }[] = [];

  constructor(scene: Scene, url: string) {
    fetch(assetUrl(url))
      .then((r) => r.arrayBuffer())
      .then((b) => this.build(scene, parseCrewFile(b)))
      .catch(() => undefined);
  }

  private build(scene: Scene, f: CrewFile): void {
    const skeleton = new Skeleton("crew-skeleton", "crew-skeleton", scene);
    for (let i = 0; i < f.joints; i++) new Bone(`crew-joint-${i}`, skeleton, null, Matrix.Identity());
    const width = (f.joints + 1) * 4;
    const vat = RawTexture.CreateRGBATexture(f.vat, width, f.vat.length / (width * 4), scene, false, false, Texture.NEAREST_SAMPLINGMODE, 1);
    vat.name = "crew-vat";
    const manager = new BakedVertexAnimationManager(scene);
    manager.texture = vat;
    const atlas = new Texture("data:crew-atlas", scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, null, null, f.atlas, false, undefined, "image/jpeg");
    const material = new StandardMaterial("crew-figure", scene);
    material.diffuseTexture = atlas;
    material.specularColor.set(0.05, 0.05, 0.05);
    // Built from glTF's right-handed numbers in Babylon's left-handed frame: mirrored, so draw both faces.
    material.backFaceCulling = false;
    for (const c of f.clips) this.clips.set(c.name, { from: c.from, to: c.from + c.frames - 1, fps: f.fps, frames: c.frames, seconds: c.seconds, rise: c.rise ?? 0, advance: c.advance ?? 0, reach: c.reach ?? 0 });
    this.meshes = f.figures.map((fig) => {
      const mesh = new Mesh(`crew-${fig.name}`, scene);
      const data = new VertexData();
      data.positions = fig.position;
      data.normals = fig.normal;
      data.uvs = fig.uv;
      data.colors = fig.color;
      // The near triangles, then the far ones (an empty list in an older file: the near ones again).
      const far = fig.lod.length > 0 ? fig.lod : fig.index;
      const indices = new Uint32Array(fig.index.length + far.length);
      indices.set(fig.index);
      indices.set(far, fig.index.length);
      data.indices = indices;
      this.levels.push({ near: fig.index.length, far: far.length });
      data.applyToMesh(mesh);
      mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, fig.joints, false, 4);
      mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, fig.weights, false, 4);
      mesh.numBoneInfluencers = 4;
      mesh.skeleton = skeleton;
      mesh.bakedVertexAnimationManager = manager;
      mesh.material = material;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      return mesh;
    });
    this.manager = manager;
  }

  /** The figure meshes once loaded (templates: each ship copies them). */
  get templates(): readonly Mesh[] | null {
    return this.meshes;
  }

  get animator(): BakedVertexAnimationManager | null {
    return this.manager;
  }

  clip(name: CrewClipName): ClipRange | null {
    return this.clips.get(name) ?? null;
  }

  /** Time of every clip (seconds of simulation, so the deck is the same on every run). */
  setTime(t: number): void {
    if (this.manager) this.manager.time = t;
  }
}
