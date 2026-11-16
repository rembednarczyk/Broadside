import { type GerstnerWave, MAX_WAVES, packWaves } from "@broadside/core";
import { Color3, Mesh, type Scene, ShaderMaterial, VertexData, Vector2, type Vector3 } from "../babylon";
import { OCEAN_FRAGMENT, OCEAN_VERTEX } from "../shaders/ocean";

/**
 * Ocean surface: one grid that follows the camera. Vertex density falls off with distance (a
 * warped grid, the usual cheap alternative to a projected grid, cf. Johanson, "Real-time water
 * rendering: introducing the projected grid concept", 2004). The grid moves in whole cells of the
 * finest spacing, so the displaced surface does not swim under the camera.
 */
const HALF = 3000;
const CELLS = 220;
/** Exponent of the warp: 1 is uniform; larger packs vertices near the centre. */
const WARP = 2.6;
const FINEST = (HALF * 2) / CELLS / 12;

const warp = (t: number): number => Math.sign(t) * Math.pow(Math.abs(t), WARP) * HALF;

export const buildOceanGrid = (): { positions: number[]; indices: number[] } => {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= CELLS; j++) {
    for (let i = 0; i <= CELLS; i++) positions.push(warp((i / CELLS) * 2 - 1), 0, warp((j / CELLS) * 2 - 1));
  }
  const row = CELLS + 1;
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
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

  constructor(scene: Scene) {
    this.mesh = new Mesh("ocean", scene);
    const grid = buildOceanGrid();
    const data = new VertexData();
    data.positions = grid.positions;
    data.indices = grid.indices;
    data.applyToMesh(this.mesh);
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.material = new ShaderMaterial("ocean", scene, { vertexSource: OCEAN_VERTEX, fragmentSource: OCEAN_FRAGMENT }, {
      attributes: ["position"],
      uniforms: ["viewProjection", "cameraPosition", "gridOffset", "time", "waveA", "waveB", "waveCount", "sunDirection", "sunColor", "skyZenith", "skyHorizon", "waterDeep", "waterShallow", "fogColor", "fogDensity", "foamAmount"],
    });
    this.material.backFaceCulling = false;
    this.material.setColor3("waterDeep", new Color3(0.008, 0.03, 0.045));
    this.material.setColor3("waterShallow", new Color3(0.04, 0.16, 0.18));
    this.mesh.material = this.material;
  }

  update(waves: readonly GerstnerWave[], time: number, cameraX: number, cameraZ: number, look: OceanLook, windSpeed: number): void {
    const packed = packWaves(waves);
    this.material.setArray4("waveA", Array.from(packed.a));
    this.material.setArray4("waveB", Array.from(packed.b));
    this.material.setInt("waveCount", Math.min(packed.count, MAX_WAVES));
    this.material.setFloat("time", time);
    const ox = Math.round(cameraX / FINEST) * FINEST;
    const oz = Math.round(cameraZ / FINEST) * FINEST;
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
