import { BoundingInfo, type Mesh, Matrix, Quaternion, type TransformNode, Vector3 } from "../babylon";
import { type AloftPose, type ClimbClip, aloftPose, aloftSeconds } from "./crew-aloft";
import { type CrewActivity, type CrewClipName, crewClip, wantAloft } from "./crew-roles";
import { type CrewSpot } from "./crew-layout";
import { type ClipRange, type CrewRig } from "./crew-rig";

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
  /** How far up the way aloft each topman is (seconds of climbing, by station), and the time of the last frame. */
  private readonly aloft = new Map<number, number>();
  private time = 0;

  constructor(private readonly plain: Mesh, private readonly parent: TransformNode) {}

  /** Puts the men at these stations and keeps the last crew count. */
  setSpots(spots: readonly CrewSpot[]): void {
    this.spots = spots;
    this.fitBox();
    this.setCrew(this.crew, this.max);
  }

  /** The figures' box: every station, every topman's way up and his top, with room for a man's size. */
  private fitBox(): void {
    if (this.figures.length === 0 || this.spots.length === 0) return;
    const points = this.spots.flatMap((s) => (s.route ? [s.at, s.route.deck, s.route.foot, s.route.head, s.route.top] : [s.at]));
    const lo = new Vector3(Infinity, Infinity, Infinity);
    const hi = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const [x, y, z] of points) {
      lo.minimizeInPlaceFromFloats(x, y, z);
      hi.maximizeInPlaceFromFloats(x, y, z);
    }
    lo.addInPlaceFromFloats(-2, -1, -2);
    hi.addInPlaceFromFloats(2, 2.5, 2);
    for (const f of this.figures) f.setBoundingInfo(new BoundingInfo(lo, hi));
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
      // Culled with the box of every place a man can be on this ship (the instances move and the
      // baked animation moves the vertices: the box is set here, not followed from the matrices),
      // so the men of a ship out of view are not animated and drawn for nothing.
      copy.alwaysSelectAsActiveMesh = false;
      copy.doNotSyncBoundingInfo = true;
      copy.thinInstanceRegisterAttribute("bakedVertexAnimationSettingsInstanced", 4);
      return copy;
    });
    this.fitBox();
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

  /**
   * Sets every manned station's clip from what the ship is doing (only rewritten when it changes)
   * and moves the topmen up and down their shrouds (crew-aloft) at simulation `time`.
   */
  animate(a: CrewActivity, time: number): void {
    const rig = this.rig;
    const dt = Math.max(0, Math.min(0.25, time - this.time));
    this.time = time;
    if (!rig || this.figures.length === 0 || !this.shown) return;
    const climb = rig.clip("climb");
    const mount = rig.clip("mount");
    const men = this.spots.slice(0, this.manned).map((s, i): { place: Matrix; clip: CrewClipName; frame: number } => {
      if (s.role !== "aloft" || !s.route || !climb || !mount) return { place: place(s), clip: crewClip(s.role, s.of, i, a), frame: -1 };
      const c = climbClip(climb);
      const m = climbClip(mount);
      const u = Math.max(0, Math.min(aloftSeconds(s.route, c, m), (this.aloft.get(i) ?? 0) + (wantAloft(s.of, a) ? dt : -dt)));
      this.aloft.set(i, u);
      const pose = aloftPose(s.route, c, m, u);
      return { place: posed(pose), clip: pose.clip, frame: pose.clip === "idle" ? -1 : pose.frame };
    });
    const key = men.map((m, i) => (this.spots[i]!.role === "aloft" ? `${m.clip}${m.frame}:${(this.aloft.get(i) ?? 0).toFixed(2)}` : m.clip)).join(",");
    if (key === this.playing) return;
    this.playing = key;
    this.figures.forEach((f, k) => {
      const mine = men.map((m, i) => ({ ...m, i })).filter(({ i }) => i % this.figures.length === k);
      f.isVisible = mine.length > 0;
      if (mine.length === 0) return;
      setMatrices(f, mine.map((m) => m.place));
      const settings = new Float32Array(mine.length * 4);
      mine.forEach(({ clip, frame, i }, n) => {
        const r = rig.clip(clip) ?? rig.clip("idle")!;
        // A climber's frame follows his place on the ratlines (held still, the game moves him);
        // the rest play their loop with a phase per man, so the hands at one rope do not move as one.
        if (frame >= 0) settings.set([r.from + frame, r.from + frame, 0, 0], n * 4);
        else settings.set([r.from, r.to, (i * 7) % r.frames, r.fps], n * 4);
      });
      f.thinInstanceSetBuffer("bakedVertexAnimationSettingsInstanced", settings, 4, false);
    });
  }
}

const climbClip = (r: ClipRange): ClimbClip => ({ seconds: r.seconds, frames: r.frames, rise: r.rise, advance: r.advance, reach: r.reach });

const posed = (p: AloftPose): Matrix => Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(p.yaw, p.lean, 0), new Vector3(...p.at));

const place = (s: CrewSpot): Matrix => Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(s.yaw, 0, 0), new Vector3(...s.at));

const setMatrices = (mesh: Mesh, matrices: Matrix[]): void => {
  const buf = new Float32Array(matrices.length * 16);
  matrices.forEach((m, i) => buf.set(m.m, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, false);
};
