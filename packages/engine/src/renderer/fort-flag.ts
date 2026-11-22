import { type Faction } from "@broadside/core";
import { DynamicTexture, Mesh, type Scene, StandardMaterial, VertexBuffer, VertexData } from "../babylon";

/**
 * A fort's colours: a cloth flag on its staff, streaming down the wind and rippling (a travelling
 * wave along the fly, its amplitude growing from the hoist to the fly and with the wind, the
 * usual procedural flag of games; the ships' cloth is simulated, a fort's flag is far and small
 * enough for the wave), its pattern telling the owner by light and dark as well as by hue (beta
 * test 22.11: in the sepia look every faction's flag was the same dark patch). White when the fort
 * has struck (silenced); a change of owner is hauled down and the new colours run up.
 */
const W = 5;
const H = 3;
const NX = 10;
const NY = 5;

type Pattern = (c: CanvasRenderingContext2D, w: number, h: number) => void;

const fill = (c: CanvasRenderingContext2D, colour: string, x: number, y: number, w: number, h: number): void => {
  c.fillStyle = colour;
  c.fillRect(x, y, w, h);
};

/** One pattern per owner, each with its own split of light and dark (readable in any colour look). */
const PATTERNS: Readonly<Record<Faction | "struck", Pattern>> = {
  // A pale cross on red.
  crown: (c, w, h) => {
    fill(c, "rgb(150,32,26)", 0, 0, w, h);
    fill(c, "rgb(235,225,205)", w * 0.3, 0, w * 0.14, h);
    fill(c, "rgb(235,225,205)", 0, h * 0.42, w, h * 0.16);
  },
  // Three horizontal bands, dark blue, white, dark blue.
  republic: (c, w, h) => {
    fill(c, "rgb(30,52,120)", 0, 0, w, h);
    fill(c, "rgb(238,236,228)", 0, h / 3, w, h / 3);
  },
  // Gold with a dark vertical band at the hoist.
  empire: (c, w, h) => {
    fill(c, "rgb(215,180,60)", 0, 0, w, h);
    fill(c, "rgb(40,30,20)", 0, 0, w * 0.33, h);
  },
  // Black with a white disc (the skull, at a fort's distance).
  pirates: (c, w, h) => {
    fill(c, "rgb(14,12,12)", 0, 0, w, h);
    c.fillStyle = "rgb(232,228,220)";
    c.beginPath();
    c.arc(w * 0.5, h * 0.45, h * 0.2, 0, Math.PI * 2);
    c.fill();
    fill(c, "rgb(232,228,220)", w * 0.36, h * 0.72, w * 0.28, h * 0.07);
  },
  // The player's: red over white, a dark border.
  player: (c, w, h) => {
    fill(c, "rgb(30,22,18)", 0, 0, w, h);
    fill(c, "rgb(160,40,30)", w * 0.06, h * 0.08, w * 0.88, h * 0.42);
    fill(c, "rgb(236,230,214)", w * 0.06, h * 0.5, w * 0.88, h * 0.42);
  },
  struck: (c, w, h) => fill(c, "rgb(242,240,232)", 0, 0, w, h),
};

const materials = new Map<string, StandardMaterial>();

export const flagMaterial = (scene: Scene, who: Faction | "struck"): StandardMaterial => {
  const key = `${scene.uid}|${who}`;
  let m = materials.get(key);
  if (!m) {
    const t = new DynamicTexture(`fort-flag-${who}`, { width: 128, height: 80 }, scene, true);
    PATTERNS[who](t.getContext() as CanvasRenderingContext2D, 128, 80);
    t.update(true);
    m = new StandardMaterial(`fort-flag-${who}`, scene);
    m.diffuseTexture = t;
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
    m.specularColor.set(0.02, 0.02, 0.02);
    materials.set(key, m);
  }
  return m;
};

/** The cloth: a grid hoisted along its left edge at the origin, the fly along +x. */
export const flagCloth = (scene: Scene, name: string): Mesh => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      positions.push((i / NX) * W, H - (j / NY) * H, 0);
      uvs.push(i / NX, 1 - j / NY);
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      indices.push(a, a + 1, a + NX + 2, a, a + NX + 2, a + NX + 1);
    }
  }
  const data = new VertexData();
  data.positions = positions;
  data.uvs = uvs;
  data.indices = indices;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  const m = new Mesh(name, scene);
  data.applyToMesh(m, true);
  m.isPickable = false;
  return m;
};

/** Depth of the ripple at a point of the fly (pure: tested), metres across the cloth. */
export const flagRipple = (u: number, time: number, wind: number, phase: number): number => {
  const amp = (0.12 + Math.min(1, wind / 12) * 0.35) * u;
  const k = 2.2;
  const speed = 2 + wind * 0.4;
  return amp * Math.sin(k * u * W - speed * time + phase) + amp * 0.35 * Math.sin(1.7 * k * u * W - 1.3 * speed * time + phase * 2);
};

/** Moves the cloth's vertices for this moment (only for forts near the camera). */
export const rippleFlag = (m: Mesh, time: number, wind: number, phase: number): void => {
  const p = m.getVerticesData(VertexBuffer.PositionKind);
  if (!p) return;
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const k = (j * (NX + 1) + i) * 3;
      const u = i / NX;
      // The fly sags a little in a light air and streams out in a breeze.
      const droop = (1 - Math.min(1, wind / 8)) * 0.6 * u * u;
      p[k] = u * W * (1 - droop * 0.2);
      p[k + 1] = H - (j / NY) * H - droop;
      p[k + 2] = flagRipple(u, time, wind, phase + j * 0.15);
    }
  }
  m.updateVerticesData(VertexBuffer.PositionKind, p);
};
