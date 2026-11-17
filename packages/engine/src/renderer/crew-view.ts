import { type Mesh, Matrix, Quaternion, type TransformNode, Vector3 } from "../babylon";
import { type CrewActivity, type CrewClipName, crewClip } from "./crew-roles";
import { type CrewSpot } from "./crew-layout";
import { type CrewRig } from "./crew-rig";

/**
 * The men on one ship's deck: the stations (crew-layout), the share of them manned (the crew left
 * aboard) and, once the animated figures have loaded (CrewRig), what each man is doing
 * (crew-roles), as thin instances of the figures with an animation per instance. Until then, and on
 * the low preset, a plain stand-in figure (one mesh) marks each station.
 */
export class CrewView {
  private spots: readonly CrewSpot[] = [];
  private figures: Mesh[] = [];
  private rig: CrewRig | null = null;
  private manned = 0;
  private crew = 1;
  private max = 1;
  private shown = true;
  /** Clip of every station last frame, to rewrite the instance buffers only when it changes. */
  private playing = "";

  constructor(private readonly plain: Mesh, private readonly parent: TransformNode) {}

  /** Puts the men at these stations and keeps the last crew count. */
  setSpots(spots: readonly CrewSpot[]): void {
    this.spots = spots;
    this.setCrew(this.crew, this.max);
  }

  /** Draws the men with the animated figures: a copy of each for this ship, the stations dealt round them in turn. */
  useRig(rig: CrewRig): void {
    const templates = rig.templates;
    if (this.figures.length > 0 || !templates || templates.length === 0) return;
    this.rig = rig;
    this.figures = templates.map((t) => {
      const copy = t.clone(`${t.name}-${this.parent.name}`, this.parent);
      copy.skeleton = t.skeleton;
      copy.bakedVertexAnimationManager = t.bakedVertexAnimationManager;
      copy.isPickable = false;
      copy.alwaysSelectAsActiveMesh = true;
      copy.thinInstanceRegisterAttribute("bakedVertexAnimationSettingsInstanced", 4);
      return copy;
    });
    this.plain.setEnabled(false);
    this.playing = "";
    this.setShown(this.shown);
    this.setCrew(this.crew, this.max);
  }

  setShown(shown: boolean): void {
    this.shown = shown;
    if (this.figures.length > 0) for (const f of this.figures) f.setEnabled(shown);
    else this.plain.setEnabled(shown);
  }

  /** Mans a share of the stations matching the crew left aboard (in the order they are manned). */
  setCrew(crew: number, max: number): void {
    this.crew = crew;
    this.max = max;
    this.manned = Math.round((this.spots.length * crew) / Math.max(1, max));
    this.playing = "";
    if (this.figures.length === 0) {
      const n = this.manned;
      this.plain.isVisible = n > 0;
      if (n > 0) setMatrices(this.plain, this.spots.slice(0, n).map(place));
    }
  }

  /** Sets every manned station's clip from what the ship is doing (only rewritten when it changes). */
  animate(a: CrewActivity): void {
    const rig = this.rig;
    if (!rig || this.figures.length === 0 || !this.shown) return;
    const clips: CrewClipName[] = this.spots.slice(0, this.manned).map((s, i) => crewClip(s.role, s.of, i, a));
    const key = clips.join(",");
    if (key === this.playing) return;
    this.playing = key;
    this.figures.forEach((f, k) => {
      const mine = clips.map((c, i) => ({ c, i })).filter(({ i }) => i % this.figures.length === k);
      f.isVisible = mine.length > 0;
      if (mine.length === 0) return;
      setMatrices(f, mine.map(({ i }) => place(this.spots[i]!)));
      const settings = new Float32Array(mine.length * 4);
      mine.forEach(({ c, i }, n) => {
        const r = rig.clip(c) ?? rig.clip("idle")!;
        // A phase per man, so the hands at one rope do not move as one.
        settings.set([r.from, r.to, (i * 7) % r.frames, r.fps], n * 4);
      });
      f.thinInstanceSetBuffer("bakedVertexAnimationSettingsInstanced", settings, 4, false);
    });
  }
}

const place = (s: CrewSpot): Matrix => Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(s.yaw, 0, 0), new Vector3(...s.at));

const setMatrices = (mesh: Mesh, matrices: Matrix[]): void => {
  const buf = new Float32Array(matrices.length * 16);
  matrices.forEach((m, i) => buf.set(m.m, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, false);
};
