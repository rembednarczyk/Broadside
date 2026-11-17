import { type Mesh } from "../babylon";
import { type MastBend, bendShare } from "./rig-motion";

/**
 * A mast drawn bent: its vertices are moved by the cantilever curve of rig-motion (zero at the
 * step, growing smoothly to the head), so the spar bows along its length as a loaded mast does,
 * instead of tilting stiffly about one point. The mesh needs rings along its height (the spars
 * are built with subdivisions) for the curve to show.
 */
export class BentMast {
  private readonly rest: Float32Array;
  private readonly moved: Float32Array;
  private lastX = 0;
  private lastZ = 0;

  constructor(readonly mesh: Mesh) {
    this.rest = new Float32Array(mesh.getVerticesData("position") ?? []);
    this.moved = new Float32Array(this.rest.length);
    mesh.markVerticesDataAsUpdatable("position", true);
  }

  apply(bend: MastBend): void {
    // Millimetres do not show: skip the upload while the mast is still.
    if (Math.abs(bend.dx - this.lastX) < 0.002 && Math.abs(bend.dz - this.lastZ) < 0.002) return;
    this.lastX = bend.dx;
    this.lastZ = bend.dz;
    for (let i = 0; i < this.rest.length; i += 3) {
      const k = bendShare(bend, this.rest[i + 1]!);
      this.moved[i] = this.rest[i]! + bend.dx * k;
      this.moved[i + 1] = this.rest[i + 1]!;
      this.moved[i + 2] = this.rest[i + 2]! + bend.dz * k;
    }
    this.mesh.updateVerticesData("position", this.moved);
  }
}
