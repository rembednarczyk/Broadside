import { type AbstractMesh, Color3, DirectionalLight, type Scene, type TransformNode, Vector3 } from "../babylon";

/**
 * The ships' fill light (three-point lighting's fill, as games light their heroes for
 * readability): a soft directional light from behind the camera that falls on the ships alone,
 * so the player's ship (and the others) read against the sea under a low or backlighting sun and
 * at night. No specular (a fill shows the shape, it adds no highlights) and no shadows. Off in
 * the cinematic camera, which keeps the reference's hard backlight (ref_090, ref_124: the ship a
 * dark silhouette against the sun), and off on request (`enabled`, the reference shots).
 * Babylon's `includedOnlyMeshes` limits it to the ships' meshes; the list is refreshed when ships
 * come and go and once a second (views build parts lazily). Materials on those meshes take up to
 * six lights, so the fill does not push the muzzle-flash lights out (four by default).
 */
export class ShipFill {
  enabled = true;
  private readonly light: DirectionalLight;
  private roots: readonly TransformNode[] = [];
  private refreshIn = 0;

  constructor(scene: Scene) {
    this.light = new DirectionalLight("ship-fill", new Vector3(0, -0.5, 1), scene);
    this.light.specular = Color3.Black();
    this.light.diffuse = new Color3(1, 0.95, 0.86);
    this.light.intensity = 0;
    this.light.includedOnlyMeshes = [];
  }

  /** The ships to light: their view roots (call when the set changes). */
  track(roots: readonly TransformNode[]): void {
    this.roots = roots;
    this.refreshIn = 0;
  }

  /**
   * Each frame: aim from the camera, a little from above, and set the strength (0 in the
   * cinematic camera). `darkness` 0 by day to 1 at night: the fill is a little stronger then.
   */
  frame(forward: Vector3, cinematic: boolean, darkness: number, dt: number): void {
    const on = this.enabled && !cinematic;
    this.light.intensity = on ? FILL_DAY + (FILL_NIGHT - FILL_DAY) * Math.max(0, Math.min(1, darkness)) : 0;
    this.light.direction.set(forward.x, Math.min(forward.y, 0) - 0.55, forward.z);
    this.refreshIn -= dt;
    if (on && this.refreshIn <= 0) {
      this.refreshIn = 1;
      this.refresh();
    }
  }

  private refresh(): void {
    const meshes: AbstractMesh[] = [];
    for (const r of this.roots) meshes.push(...r.getChildMeshes(false));
    for (const m of meshes) if (m.material && "maxSimultaneousLights" in m.material) (m.material as { maxSimultaneousLights: number }).maxSimultaneousLights = Math.max(6, (m.material as { maxSimultaneousLights: number }).maxSimultaneousLights);
    this.light.includedOnlyMeshes = meshes;
  }
}

/** Strength of the fill by day and at night (the sun's key is about 1.4 at noon, 2.2 at its peak). */
export const FILL_DAY = 0.5;
export const FILL_NIGHT = 0.9;
