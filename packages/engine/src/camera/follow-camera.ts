import { ArcRotateCamera, type Scene, Vector3 } from "../babylon";

/**
 * Chase camera around the player's ship: a high three-quarter view as in Overboard!, orbit and
 * zoom by drag, pinch and wheel (Babylon's ArcRotateCamera inputs), and a critically damped
 * follow of the target (exponential smoothing, frame-rate independent: 1 - exp(-k dt)).
 */
export class FollowCamera {
  readonly camera: ArcRotateCamera;
  private readonly target = new Vector3();
  /** Height of the aim point above the ship: the middle of the rig frames a ship like the reference. */
  private lift = 3;

  constructor(scene: Scene, canvas: HTMLCanvasElement | null) {
    this.camera = new ArcRotateCamera("follow", -Math.PI / 2, 1.22, 70, Vector3.Zero(), scene);
    this.camera.lowerBetaLimit = 0.35;
    this.camera.upperBetaLimit = 1.45;
    this.camera.lowerRadiusLimit = 18;
    this.camera.upperRadiusLimit = 260;
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.pinchDeltaPercentage = 0.004;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 6000;
    this.camera.fov = 0.9;
    this.camera.panningSensibility = 0;
    if (canvas) this.camera.attachControl(canvas, true);
  }

  /** Frames a ship of the given length on first use. */
  frameShip(length: number, rigHeight = 10): void {
    this.camera.radius = Math.max(28, length * 2.1);
    this.lift = rigHeight * 0.35;
  }

  follow(x: number, y: number, z: number, dt: number): void {
    const k = 1 - Math.exp(-6 * dt);
    this.target.set(this.target.x + (x - this.target.x) * k, this.target.y + (y + this.lift - this.target.y) * k, this.target.z + (z - this.target.z) * k);
    this.camera.target.copyFrom(this.target);
  }

  snap(x: number, y: number, z: number): void {
    this.target.set(x, y + this.lift, z);
    this.camera.target.copyFrom(this.target);
  }

  /** Heading the camera looks along on the water plane (for screen-relative controls). */
  viewHeading(): number {
    const d = this.camera.target.subtract(this.camera.position);
    return Math.atan2(d.x, d.z);
  }
}
