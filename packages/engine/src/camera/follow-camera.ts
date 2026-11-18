import { ArcRotateCamera, Quaternion, type Scene, Vector3 } from "../babylon";
import { type CineState, orbitRadius, rideStep, tiltStep } from "./cinematic";
import { bindTwist } from "./twist";

/**
 * Chase camera around the player's ship: a high three-quarter view as in Overboard!, orbit and
 * zoom by drag, pinch and wheel (Babylon's ArcRotateCamera inputs), and a critically damped
 * follow of the target (exponential smoothing, frame-rate independent: 1 - exp(-k dt)).
 */
export type CameraMode = "isometric" | "chase" | "cinematic" | "deck";
export const CAMERA_MODES: readonly CameraMode[] = ["isometric", "chase", "cinematic", "deck"];
/** Vertical field of view (radians): the following cameras, and the wider deck camera. */
const FOV = 0.9;
const DECK_FOV = 1.2;

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
  /** Nearest enemy in a fight: the isometric view widens to keep both ships in frame. */
  readonly focus?: { readonly x: number; readonly z: number } | null;
  /** Height of the sea at a point (the cinematic camera rides it). */
  readonly surface?: (x: number, z: number) => number;
}

export class FollowCamera {
  mode: CameraMode = "isometric";
  private lastMode: CameraMode | null = null;
  /** The cinematic eye riding the swell (null until the mode is entered). */
  private cine: CineState | null = null;
  readonly camera: ArcRotateCamera;
  private readonly target = new Vector3();
  /** Height of the aim point above the ship: the middle of the rig frames a ship like the reference. */
  private lift = 3;
  /** Extra half-height of the isometric frame for a fight (smoothed). */
  private combatHalf = 0;
  private readonly aim = { x: 0, z: 0 };
  /** The player's isometric zoom (wheel, pinch); the orbit radius also carries the combat pull-back. */
  private isoZoom = 0;
  private setRadius = -1;
  /** Lets the chase orbit come within a few metres of the ship (inspecting the model). */
  closeUp = false;
  /** Half-height of the isometric frame in metres (marks on the water scale with it). */
  viewHalf = 60;

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
    this.camera.fov = FOV;
    this.camera.panningSensibility = 0;
    if (canvas) this.camera.attachControl(canvas, true);
    // Simple steering draws courses with a one-finger (or left-button) drag: the orbit then turns
    // only with the right button; pinch and wheel zoom as before (Babylon's pointer input routes
    // single-pointer drags to onTouch, and buttonsPressed tells the left button from the right).
    const pointers = this.camera.inputs.attached["pointers"] as unknown as { onTouch: (p: unknown, x: number, y: number) => void; _buttonsPressed?: number } | undefined;
    if (pointers) {
      const orbit = pointers.onTouch.bind(pointers);
      pointers.onTouch = (p, x, y) => {
        if (this.drawGestures && (pointers._buttonsPressed ?? 1) === 1) return;
        orbit(p, x, y);
      };
    }
    // ...and on a phone two fingers twist the view round (bindTwist), as on a map.
    if (canvas) bindTwist(canvas, (d) => {
      if (this.drawGestures) this.camera.alpha -= d;
    });
  }

  /** A one-finger or left-button drag draws a course instead of turning the view (simple steering). */
  drawGestures = false;

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
      // Combat framing (Black Flag pulls back in a fight): widen to hold both ships, and aim
      // halfway between them.
      if (this.camera.radius !== this.setRadius) this.isoZoom = this.camera.radius;
      const base = this.isoZoom * 0.42;
      const gap = p.focus ? Math.hypot(p.focus.x - p.x, p.focus.z - p.z) : 0;
      const wanted = p.focus ? Math.max(0, Math.min(240, gap * 0.62 + 30) - base) : 0;
      const k = 1 - Math.exp(-1.5 * dt);
      this.combatHalf += (wanted - this.combatHalf) * k;
      const share = p.focus ? 0.5 : 0;
      this.aim.x += ((p.focus ? p.focus.x - p.x : 0) * share - this.aim.x) * k;
      this.aim.z += ((p.focus ? p.focus.z - p.z : 0) * share - this.aim.z) * k;
      const half = base + this.combatHalf;
      // In an orthographic view the bottom of a wider frame comes nearer the eye than the eye's
      // distance: a near plane behind the eye (allowed in an orthographic projection) keeps the
      // sea in frame without moving the eye (the fog, which grows with distance, stays the same).
      this.camera.radius = this.isoZoom;
      this.setRadius = this.camera.radius;
      this.viewHalf = half;
      const aspect = this.camera.getEngine().getAspectRatio(this.camera);
      this.camera.orthoTop = half;
      this.camera.orthoBottom = -half;
      this.camera.orthoLeft = -half * aspect;
      this.camera.orthoRight = half * aspect;
    }
    // The orbit's minimum radius would push a deck eye off the ship.
    this.camera.lowerRadiusLimit = this.mode === "deck" ? 0.5 : this.closeUp ? 6 : 18;
    if (this.mode === "deck") {
      const q = new Quaternion(p.qx, p.qy, p.qz, p.qw);
      const eye = new Vector3(...p.deck).rotateByQuaternionToRef(q, new Vector3()).addInPlaceFromFloats(p.x, p.y, p.z);
      // Looking forward and a touch down along the deck, wide like a hand-held lens.
      const ahead = new Vector3(p.deck[0] * 0.3, p.deck[1] - 1.5, p.deck[2] + 30).rotateByQuaternionToRef(q, new Vector3()).addInPlaceFromFloats(p.x, p.y, p.z);
      this.camera.fov = DECK_FOV;
      this.camera.setTarget(ahead);
      this.camera.setPosition(eye);
      return;
    }
    this.camera.fov = FOV;
    if (this.mode === "cinematic" && p.surface) {
      // Low over the swell, riding it, circling the ship (cinematic.ts); aimed at her hull and lower rig.
      const surface = p.surface;
      this.cine ??= { angle: this.camera.alpha, t: 0, y: surface(p.x, p.z) + 1.3 };
      const eye = rideStep(this.cine, p, surface, dt);
      this.follow(p.x, p.y - this.lift * 0.4, p.z, dt);
      // Under the surface the aim rises to look up at it (about 45 degrees, as in ref_161).
      const up = tiltStep(this.cine, surface(eye.x, eye.z) - eye.y, dt) * orbitRadius(p.length) * 0.95;
      this.camera.setTarget(new Vector3(this.target.x, this.target.y + up, this.target.z));
      this.camera.setPosition(new Vector3(eye.x, eye.y, eye.z));
      return;
    }
    this.cine = null;
    if (this.mode === "isometric") this.follow(p.x + this.aim.x, p.y, p.z + this.aim.z, dt);
    else this.follow(p.x, p.y, p.z, dt);
  }

  /** Projection and limits when the mode changes (isometric is orthographic, the rest perspective). */
  private enterMode(length: number): void {
    if (this.mode === this.lastMode) return;
    this.lastMode = this.mode;
    const iso = this.mode === "isometric";
    this.camera.mode = iso ? 1 : 0; // Camera.ORTHOGRAPHIC_CAMERA : PERSPECTIVE_CAMERA
    // The cinematic eye looks up at the ship from the water and, under it, up at the surface.
    this.camera.upperBetaLimit = iso ? ISO_BETA : this.mode === "cinematic" ? 2.9 : 1.78;
    this.camera.minZ = iso ? -1500 : 0.5;
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
