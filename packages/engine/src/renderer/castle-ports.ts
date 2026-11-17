import { Matrix, type Mesh, MeshBuilder, Quaternion, type Scene, StandardMaterial, Vector3 } from "../babylon";
import { type CastlePort } from "./castle-layout";

/**
 * Gun ports of the sterncastle (layout: castle-layout `ports`): for each gun that stands inside the
 * castle, a dark square opening on the wall where its barrel comes out, framed by four bars, with
 * the lid triced up above it as on a ship cleared for action. Thin instances (Flyweight): one box
 * mesh for the wood, one for the openings.
 */
const WIDTH = 0.82;
const HEIGHT = 0.74;

const darkMaterial = (scene: Scene): StandardMaterial => {
  const cached = scene.getMaterialByName("castle-port");
  if (cached) return cached as StandardMaterial;
  const m = new StandardMaterial("castle-port", scene);
  m.diffuseColor.set(0.02, 0.018, 0.015);
  m.specularColor.set(0, 0, 0);
  return m;
};

const fill = (mesh: Mesh, list: Matrix[]): void => {
  const buf = new Float32Array(list.length * 16);
  list.forEach((m, i) => m.copyToArray(buf, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
  mesh.alwaysSelectAsActiveMesh = true;
};

export const buildCastlePorts = (scene: Scene, name: string, ports: readonly CastlePort[], wood: StandardMaterial): Mesh[] => {
  if (ports.length === 0) return [];
  const bar = MeshBuilder.CreateBox(`castle-port-frames-${name}`, { size: 1 }, scene);
  bar.material = wood;
  const hole = MeshBuilder.CreateBox(`castle-port-holes-${name}`, { size: 1 }, scene);
  hole.material = darkMaterial(scene);
  const bars: Matrix[] = [];
  const holes: Matrix[] = [];
  for (const port of ports) {
    const n = new Vector3(...port.n);
    const at = new Vector3(...port.at);
    const yaw = Math.atan2(n.x, n.z);
    const rot = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
    const tan = new Vector3(n.z, 0, -n.x);
    const place = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, list: Matrix[], q = rot): void => {
      list.push(Matrix.Compose(new Vector3(sx, sy, sz), q, at.add(tan.scale(lx)).add(new Vector3(0, ly, 0)).add(n.scale(lz))));
    };
    // The opening stands just proud of the planking (the strakes lap out 35 mm), the frame prouder.
    place(0, 0, 0.045, WIDTH, HEIGHT, 0.03, holes);
    for (const s of [-1, 1]) {
      place((s * WIDTH) / 2, 0, 0.07, 0.1, HEIGHT + 0.1, 0.1, bars);
      place(0, (s * HEIGHT) / 2, 0.07, WIDTH + 0.1, 0.1, 0.1, bars);
    }
    // The lid, hinged at the head of the port and hauled up to some sixty degrees.
    const lid = Quaternion.RotationYawPitchRoll(yaw, -1.05, 0);
    place(0, HEIGHT / 2 + 0.05 + 0.18, 0.07 + 0.32, WIDTH, HEIGHT, 0.06, bars, lid);
  }
  fill(bar, bars);
  fill(hole, holes);
  return [bar, hole];
};
