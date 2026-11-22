import { type SplashUniforms } from "./splash-patches";
import { type GerstnerWave, MAX_WAVES, createRng, makeWave, packWaves, range } from "@broadside/core";
import { BoundingInfo, Color3, Mesh, type Scene, ShaderMaterial, VertexData, Vector2, Vector3 } from "../babylon";
import { OCEAN_FRAGMENT, OCEAN_VERTEX } from "../shaders/ocean";
import { type TrailUniforms } from "./wake-trails";

/**
 * Ocean surface: one grid that follows the camera. Vertex density falls off with distance (a
 * warped grid, the usual cheap alternative to a projected grid, cf. Johanson, "Real-time water
 * rendering: introducing the projected grid concept", 2004). The grid moves in whole cells of the
 * finest spacing, so the displaced surface does not swim under the camera. It is drawn as TILES x
 * TILES meshes over the same vertices (chunked culling, as terrain is chunked: Ulrich 2002), so the
 * frustum drops the part behind the camera; each tile's box is widened by the waves' reach.
 */
const HALF = 3000;
/** Exponent of the warp: 1 is uniform; larger packs vertices near the centre. */
const WARP = 2.6;
const finest = (cells: number): number => (HALF * 2) / cells / 12;

const warp = (t: number): number => Math.sign(t) * Math.pow(Math.abs(t), WARP) * HALF;

/** Tiles per side of the grid (each a draw call; 16 in all, a quarter of the cells per side apiece). */
const TILES = 4;
/** How far (m) the waves can carry the surface beyond a tile's flat outline, up, down and sideways. */
const WAVE_REACH = 40;

/**
 * Cells i0..i1, j0..j1 of the warped grid (the whole grid by default). Tiles share their edge
 * vertices: the same index gives the same position, so neighbours meet without cracks.
 */
export const buildOceanGrid = (cells = 220, i0 = 0, i1 = cells, j0 = 0, j1 = cells): { positions: number[]; indices: number[] } => {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) positions.push(warp((i / cells) * 2 - 1), 0, warp((j / cells) * 2 - 1));
  }
  const row = i1 - i0 + 1;
  for (let j = 0; j < j1 - j0; j++) {
    for (let i = 0; i < i1 - i0; i++) {
      const a = j * row + i;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  return { positions, indices };
};

const WATER_DEEP = new Color3(0.008, 0.03, 0.045);
const WATER_SHALLOW = new Color3(0.04, 0.16, 0.18);

export interface OceanLook {
  readonly sunDirection: Vector3;
  readonly sunColor: Color3;
  readonly skyZenith: Color3;
  readonly skyHorizon: Color3;
  readonly fogColor: Color3;
  readonly fogDensity: number;
  /** Daylight 0..1 reaching the water: the sea's own colour is light scattered back from below. */
  readonly daylight: number;
  /** 0..1 how much of the sun's disc shows through the cloud: the glint and the glitter path go with it. */
  readonly glint: number;
}

export class Ocean {
  /** The grid's tiles (all of one material). */
  readonly tiles: Mesh[] = [];
  /** Each tile's box round the origin (the grid unshifted). */
  private readonly boxes: { lo: Vector3; hi: Vector3 }[] = [];
  private shifted = { x: NaN, z: NaN };
  private readonly material: ShaderMaterial;

  private readonly cells: number;
  /** Visual-only short waves, amplitudes for a 10 m/s wind (scaled with the wind each frame). */
  private readonly detail: GerstnerWave[];

  constructor(scene: Scene, cells = 220, detailWaves = 0) {
    this.cells = cells;
    const rng = createRng(4242);
    this.detail = Array.from({ length: detailWaves }, (_, i) => makeWave(range(rng, -0.9, 0.9), 1.3 + i * 0.83 + range(rng, -0.2, 0.2), 0.012 + i * 0.004, 0.6, range(rng, 0, Math.PI * 2), 8));
    const cut = (k: number) => Math.round((k * cells) / TILES);
    for (let tj = 0; tj < TILES; tj++) {
      for (let ti = 0; ti < TILES; ti++) {
        const tile = new Mesh(`ocean-${ti}-${tj}`, scene);
        const grid = buildOceanGrid(cells, cut(ti), cut(ti + 1), cut(tj), cut(tj + 1));
        const data = new VertexData();
        data.positions = grid.positions;
        data.indices = grid.indices;
        data.applyToMesh(tile);
        // The shader places the vertices (grid offset, waves); the box only has to hold them.
        const { minimum: lo, maximum: hi } = tile.getBoundingInfo();
        const box = { lo: new Vector3(lo.x - WAVE_REACH, -WAVE_REACH, lo.z - WAVE_REACH), hi: new Vector3(hi.x + WAVE_REACH, WAVE_REACH, hi.z + WAVE_REACH) };
        tile.setBoundingInfo(new BoundingInfo(box.lo, box.hi));
        tile.isPickable = false;
        // The world matrix stays the identity (the water does not move with the grid: no false
        // velocity for the motion blur); the box alone follows the offset.
        tile.freezeWorldMatrix();
        this.tiles.push(tile);
        this.boxes.push(box);
      }
    }
    this.material = new ShaderMaterial("ocean", scene, { vertexSource: OCEAN_VERTEX, fragmentSource: OCEAN_FRAGMENT }, {
      attributes: ["position"],
      uniforms: ["viewProjection", "cameraPosition", "gridOffset", "time", "waveA", "waveB", "waveCount", "sunDirection", "sunColor", "skyZenith", "skyHorizon", "waterDeep", "waterShallow", "fogColor", "fogDensity", "foamAmount", "sunGlint", "shipA", "shipB", "shipCount", "trail", "trailMeta", "trailReach", "trailCount", "splash", "splashCount", "underwater", "detailA", "detailB", "detailCount", "islands", "spines", "islandCount"],
    });
    this.material.backFaceCulling = false;
    this.setIslands([]);
    for (const t of this.tiles) t.material = this.material;
  }

  /** Islands in the shallows term now (the frame bench switches the term off and on). */
  islandCount = 0;

  /** Landmasses for the shallows and surf term: centre, radius, shoal, spine and roughness, at most 32 (nearest first). */
  setIslands(list: readonly { x: number; z: number; radius: number; shoal: number; spine?: { dx: number; dz: number }; rough?: number }[]): void {
    const a = new Array<number>(128).fill(0);
    const b = new Array<number>(128).fill(0);
    list.slice(0, 32).forEach((is, i) => {
      a.splice(i * 4, 4, is.x, is.z, is.radius, is.shoal);
      b.splice(i * 4, 4, is.spine?.dx ?? 0, is.spine?.dz ?? 0, is.rough ?? 0.5, 0);
    });
    this.material.setArray4("islands", a);
    this.material.setArray4("spines", b);
    this.islandCount = Math.min(32, list.length);
    this.material.setInt("islandCount", this.islandCount);
  }

  setUnderwater(under: boolean): void {
    this.material.setFloat("underwater", under ? 1 : 0);
  }

  /** Ships for the wake term (nearest first, at most 8): position, heading, speed and size. */
  /** `slap` 0..1: how hard the sea has lately struck the sides (effects/hull-slap): whiter water along the waterline. */
  setShips(ships: readonly { x: number; z: number; heading: number; speed: number; length: number; beam: number; slap?: number }[]): void {
    const a = new Array<number>(32).fill(0);
    const b = new Array<number>(32).fill(0);
    ships.slice(0, 8).forEach((s, i) => {
      a.splice(i * 4, 4, s.x, s.z, Math.sin(s.heading), Math.cos(s.heading));
      b.splice(i * 4, 4, s.speed, s.length, s.beam, s.slap ?? 0);
    });
    this.material.setArray4("shipA", a);
    this.material.setArray4("shipB", b);
    this.material.setInt("shipCount", Math.min(8, ships.length));
  }

  /** Trails of the nearest ships (wake-trails): the wakes follow the course sailed. */
  setTrails(t: TrailUniforms): void {
    this.material.setArray4("trail", Array.from(t.points));
    this.material.setArray4("trailMeta", Array.from(t.meta));
    this.material.setFloats("trailReach", Array.from(t.reach));
    this.material.setInt("trailCount", t.count);
  }

  /** The newest falls of shot (splash-patches): foam where they struck. */
  setSplashes(u: SplashUniforms): void {
    this.material.setArray4("splash", Array.from(u.data));
    this.material.setInt("splashCount", u.count);
  }

  update(waves: readonly GerstnerWave[], time: number, cameraX: number, cameraZ: number, look: OceanLook, windSpeed: number, windDirection = 0): void {
    const packed = packWaves(waves);
    this.material.setArray4("waveA", Array.from(packed.a));
    this.material.setArray4("waveB", Array.from(packed.b));
    this.material.setInt("waveCount", Math.min(packed.count, MAX_WAVES));
    this.material.setFloat("time", time);
    const f = finest(this.cells);
    const ox = Math.round(cameraX / f) * f;
    const oz = Math.round(cameraZ / f) * f;
    const k = Math.min(1.6, Math.max(0.2, windSpeed / 10));
    // Detail waves travel around the wind direction (rotated from the generated spread).
    const c = Math.cos(windDirection);
    const s = Math.sin(windDirection);
    const det = packWaves(this.detail.map((w) => ({ ...w, dirX: w.dirX * c + w.dirZ * s, dirZ: -w.dirX * s + w.dirZ * c, amplitude: w.amplitude * k, qa: w.qa * k })));
    this.material.setArray4("detailA", Array.from(det.a));
    this.material.setArray4("detailB", Array.from(det.b));
    this.material.setInt("detailCount", this.detail.length);
    this.material.setVector2("gridOffset", new Vector2(ox, oz));
    // The tiles' boxes stand where the shader draws them, for the frustum's sake.
    if (ox !== this.shifted.x || oz !== this.shifted.z) {
      this.shifted = { x: ox, z: oz };
      const off = new Vector3(ox, 0, oz);
      this.tiles.forEach((t, i) => t.getBoundingInfo().reConstruct(this.boxes[i]!.lo.add(off), this.boxes[i]!.hi.add(off), t.getWorldMatrix()));
    }
    this.material.setVector3("sunDirection", look.sunDirection);
    this.material.setColor3("sunColor", look.sunColor);
    this.material.setColor3("skyZenith", look.skyZenith);
    this.material.setColor3("skyHorizon", look.skyHorizon);
    this.material.setColor3("fogColor", look.fogColor);
    this.material.setFloat("fogDensity", look.fogDensity);
    // The body colour is sunlight scattered in the water: it fades with the day (a floor for moonlight).
    const lit = 0.1 + 0.9 * Math.max(0, Math.min(1, look.daylight));
    this.material.setColor3("waterDeep", WATER_DEEP.scale(lit));
    this.material.setColor3("waterShallow", WATER_SHALLOW.scale(lit));
    this.material.setFloat("sunGlint", look.glint);
    this.material.setFloat("foamAmount", Math.min(1, Math.max(0, (windSpeed - 4) / 10)));
  }
}
