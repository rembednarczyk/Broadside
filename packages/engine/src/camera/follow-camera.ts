import { ArcRotateCamera, Quaternion, type Scene, Vector3 } from "../babylon";

/**
 * Chase camera around the player's ship: a high three-quarter view as in Overboard!, orbit and
 * zoom by drag, pinch and wheel (Babylon's ArcRotateCamera inputs), and a critically damped
 * follow of the target (exponential smoothing, frame-rate independent: 1 - exp(-k dt)).
 */
export type CameraMode = "isometric" | "chase" | "cinematic" | "deck";
export const CAMERA_MODES: readonly CameraMode[] = ["isometric", "chase", "cinematic", "deck"];

/** True isometric elevation: atan(1 / sqrt 2) = 35.26 deg above the horizon. */
const ISO_BETA = Math.PI / 2 - Math.atan(1 / Math.SQRT2);

/** Pose of the followed ship for the camera (world space). */
export interface ShipPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rotation quaternion of the hull. */
  readonly qx: number;
  readonly qy: number;
  readonly qz: number;
  readonly qw: number;
  /** Eye point on the quarterdeck in body space (x, y, z) for the deck camera. */
  readonly deck: readonly [number, number, number];
  readonly length: number;
}

export class FollowCamera {
  mode: CameraMode = "isometric";
  private lastMode: CameraMode | null = null;
  private drift = 0;
  readonly camera: ArcRotateCamera;
  private readonly target = new Vector3();
  /** Height of the aim point above the ship: the middle of the rig frames a ship like the reference. */
  private lift = 3;

  constructor(scene: Scene, canvas: HTMLCanvasElement | null) {
    this.camera = new ArcRotateCamera("follow", -Math.PI / 2, 1.22, 70, Vector3.Zero(), scene);
    this.camera.lowerBetaLimit = 0.35;
    // Below the horizon the camera can dip under the sea (as the reference does).
    this.camera.upperBetaLimit = 1.78;
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

  /**
   * Places the camera for the current mode: chase (orbit the player controls), cinematic (low
   * over the water, slowly circling the ship: the reference's tracking shots) or deck (on the
   * quarterdeck, riding the ship's roll and pitch).
   */
  place(p: ShipPose, dt: number): void {
    this.enterMode(p.length);
    if (this.mode === "isometric") {
      // Orthographic projection sized by the zoom (the orbit radius), elevation locked.
      this.camera.beta = ISO_BETA;
      const half = this.camera.radius * 0.42;
      const aspect = this.camera.getEngine().getAspectRatio(this.camera);
      this.camera.orthoTop = half;
      this.camera.orthoBottom = -half;
      this.camera.orthoLeft = -half * aspect;
      this.camera.orthoRight = half * aspect;
    }
    // The orbit's minimum radius would push a deck eye off the ship.
    this.camera.lowerRadiusLimit = this.mode === "deck" ? 0.5 : 18;
    if (this.mode === "deck") {
      const q = new Quaternion(p.qx, p.qy, p.qz, p.qw);
      const eye = new Vector3(...p.deck).rotateByQuaternionToRef(q, new Vector3()).addInPlaceFromFloats(p.x, p.y, p.z);
      const ahead = new Vector3(p.deck[0] * 0.3, p.deck[1] + 14, p.deck[2] + 30).rotateByQuaternionToRef(q, new Vector3()).addInPlaceFromFloats(p.x, p.y, p.z);
      this.camera.setTarget(ahead);
      this.camera.setPosition(eye);
      return;
    }
    if (this.mode === "cinematic") {
      this.drift += dt * 0.05;
      this.camera.alpha += dt * 0.05;
      this.camera.beta = 1.5 + Math.sin(this.drift * 0.7) * 0.03;
      this.camera.radius = p.length * 2.3;
    }
    this.follow(p.x, p.y, p.z, dt);
  }

  /** Projection and limits when the mode changes (isometric is orthographic, the rest perspective). */
  private enterMode(length: number): void {
    if (this.mode === this.lastMode) return;
    this.lastMode = this.mode;
    const iso = this.mode === "isometric";
    this.camera.mode = iso ? 1 : 0; // Camera.ORTHOGRAPHIC_CAMERA : PERSPECTIVE_CAMERA
    this.camera.upperBetaLimit = iso ? ISO_BETA : 1.78;
    this.camera.lowerBetaLimit = iso ? ISO_BETA : 0.35;
    if (iso) this.camera.radius = Math.max(60, length * 3.2);
    else if (this.mode === "chase") this.camera.radius = Math.max(28, length * 2.1);
  }

  follow(x: number, y: number, z: number, dt: number): void {
    const k = 1 - Math.exp(-6 * dt);
    this.target.set(this.target.x + (x - this.target.x) * k, this.target.y + (y + (this.mode === "isometric" ? 1 : this.lift) - this.target.y) * k, this.target.z + (z - this.target.z) * k);
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
