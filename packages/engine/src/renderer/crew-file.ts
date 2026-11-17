/**
 * Reader of the animated crew file (tools/assets/crew-anim.mjs, pure, tested): "BCRW", version,
 * header length, a JSON header, then the arrays it points to (byte offsets from the end of the
 * header, lengths in elements) and the texture atlas (JPEG).
 */
export interface CrewClip {
  readonly name: string;
  /** First row of the clip in the vertex animation texture, and its number of frames. */
  readonly from: number;
  readonly frames: number;
  readonly seconds: number;
}

export interface CrewFigureData {
  readonly name: string;
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
  readonly color: Float32Array;
  /** Four joint indices per vertex (as floats, as Babylon takes them) and their weights. */
  readonly joints: Float32Array;
  readonly weights: Float32Array;
  readonly index: Uint16Array;
}

export interface CrewFile {
  readonly joints: number;
  readonly fps: number;
  readonly clips: readonly CrewClip[];
  /** Per frame a row of (joints + 1) column-major matrices. */
  readonly vat: Float32Array;
  readonly figures: readonly CrewFigureData[];
  readonly atlas: Uint8Array;
}

interface Range {
  readonly offset: number;
  readonly length: number;
}

interface Header {
  joints: number;
  fps: number;
  clips: CrewClip[];
  vat: Range;
  atlas: Range;
  figures: { name: string; position: Range; normal: Range; uv: Range; color: Range; joints: Range; weights: Range; index: Range }[];
}

export const parseCrewFile = (buffer: ArrayBuffer): CrewFile => {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "BCRW" || view.getUint32(4, true) !== 1) throw new Error("not a crew file");
  const length = view.getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, length))) as Header;
  const base = 12 + length;
  const f32 = (r: Range): Float32Array => new Float32Array(buffer, base + r.offset, r.length);
  return {
    joints: header.joints,
    fps: header.fps,
    clips: header.clips,
    vat: f32(header.vat),
    atlas: new Uint8Array(buffer, base + header.atlas.offset, header.atlas.length),
    figures: header.figures.map((f) => ({
      name: f.name,
      position: f32(f.position),
      normal: f32(f.normal),
      uv: f32(f.uv),
      color: f32(f.color),
      joints: Float32Array.from(new Uint8Array(buffer, base + f.joints.offset, f.joints.length)),
      weights: f32(f.weights),
      index: new Uint16Array(buffer, base + f.index.offset, f.index.length),
    })),
  };
};
