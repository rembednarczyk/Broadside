import { type GerstnerWave, MAX_WAVES, createRng, makeWave, packWaves, range } from "@broadside/core";
import { Color3, Mesh, type Scene, ShaderMaterial, VertexData, Vector2, type Vector3 } from "../babylon";
import { OCEAN_FRAGMENT, OCEAN_VERTEX } from "../shaders/ocean";

/**
 * Ocean surface: one grid that follows the camera. Vertex density falls off with distance (a
 * warped grid, the usual cheap alternative to a projected grid, cf. Johanson, "Real-time water
 * rendering: introducing the projected grid concept", 2004). The grid moves in whole cells of the
 * finest spacing, so the displaced surface does not swim under the camera.
 */
const HALF = 3000;
/** Exponent of the warp: 1 is uniform; larger packs vertices near the centre. */
const WARP = 2.6;
const finest = (cells: number): number => (HALF * 2) / cells / 12;

const warp = (t: number): number => Math.sign(t) * Math.pow(Math.abs(t), WARP) * HALF;

export const buildOceanGrid = (cells = 220): { positions: number[]; indices: number[] } => {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= cells; j++) {
    for (let i = 0; i <= cells; i++) positions.push(warp((i / cells) * 2 - 1), 0, warp((j / cells) * 2 - 1));
  }
  const row = cells + 1;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * row + i;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  return { positions, indices };
};

export interface OceanLook {
  readonly sunDirection: Vector3;
  readonly sunColor: Color3;
  readonly skyZenith: Color3;
  readonly skyHorizon: Color3;
  readonly fogColor: Color3;
  readonly fogDensity: number;
}

export class Ocean {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  private readonly cells: number;
  /** Visual-only short waves, amplitudes for a 10 m/s wind (scaled with the wind each frame). */
  private readonly detail: GerstnerWave[];

  constructor(scene: Scene, cells = 220, detailWaves = 0) {
    this.cells = cells;
    const rng = createRng(4242);
    this.detail = Array.from({ length: detailWaves }, (_, i) => makeWave(range(rng, 0, Math.PI * 2), 1.4 + i * 0.7, 0.025 + i * 0.006, 0.7, range(rng, 0, Math.PI * 2), 8));
    this.mesh = new Mesh("ocean", scene);
    const grid = buildOceanGrid(cells);
    const data = new VertexData();
    data.positions = grid.positions;
    data.indices = grid.indices;
    data.applyToMesh(this.mesh);
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.material = new ShaderMaterial("ocean", scene, { vertexSource: OCEAN_VERTEX, fragmentSource: OCEAN_FRAGMENT }, {
      attributes: ["position"],
      uniforms: ["viewProjection", "cameraPosition", "gridOffset", "time", "waveA", "waveB", "waveCount", "sunDirection", "sunColor", "skyZenith", "skyHorizon", "waterDeep", "waterShallow", "fogColor", "fogDensity", "foamAmount", "shipA", "shipB", "shipCount", "underwater", "detailA", "detailB", "detailCount"],
    });
    this.material.backFaceCulling = false;
    this.material.setColor3("waterDeep", new Color3(0.008, 0.03, 0.045));
    this.material.setColor3("waterShallow", new Color3(0.04, 0.16, 0.18));
    this.mesh.material = this.material;
  }

  setUnderwater(under: boolean): void {
    this.material.setFloat("underwater", under ? 1 : 0);
  }

  /** Ships for the wake term (nearest first, at most 8): position, heading, speed and size. */
  setShips(ships: readonly { x: number; z: number; heading: number; speed: number; length: number; beam: number }[]): void {
    const a = new Array<number>(32).fill(0);
    const b = new Array<number>(32).fill(0);
    ships.slice(0, 8).forEach((s, i) => {
      a.splice(i * 4, 4, s.x, s.z, Math.sin(s.heading), Math.cos(s.heading));
      b.splice(i * 4, 4, s.speed, s.length, s.beam, 0);
    });
    this.material.setArray4("shipA", a);
    this.material.setArray4("shipB", b);
    this.material.setInt("shipCount", Math.min(8, ships.length));
  }

  update(waves: readonly GerstnerWave[], time: number, cameraX: number, cameraZ: number, look: OceanLook, windSpeed: number): void {
    const packed = packWaves(waves);
    this.material.setArray4("waveA", Array.from(packed.a));
    this.material.setArray4("waveB", Array.from(packed.b));
    this.material.setInt("waveCount", Math.min(packed.count, MAX_WAVES));
    this.material.setFloat("time", time);
    const f = finest(this.cells);
    const ox = Math.round(cameraX / f) * f;
    const oz = Math.round(cameraZ / f) * f;
    const k = Math.min(1.6, Math.max(0.2, windSpeed / 10));
    const det = packWaves(this.detail.map((w) => ({ ...w, amplitude: w.amplitude * k, qa: w.qa * k })));
    this.material.setArray4("detailA", Array.from(det.a));
    this.material.setArray4("detailB", Array.from(det.b));
    this.material.setInt("detailCount", this.detail.length);
    this.material.setVector2("gridOffset", new Vector2(ox, oz));
    this.material.setVector3("sunDirection", look.sunDirection);
    this.material.setColor3("sunColor", look.sunColor);
    this.material.setColor3("skyZenith", look.skyZenith);
    this.material.setColor3("skyHorizon", look.skyHorizon);
    this.material.setColor3("fogColor", look.fogColor);
    this.material.setFloat("fogDensity", look.fogDensity);
    this.material.setFloat("foamAmount", Math.min(1, Math.max(0, (windSpeed - 4) / 10)));
  }
}
