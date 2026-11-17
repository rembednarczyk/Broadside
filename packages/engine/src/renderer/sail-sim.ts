import { SAIL_COLS, SAIL_ROWS, type SailOutline, sailPositions } from "./sail-geometry";
import { SAIL_LAYOUT } from "./sail-texture";

/**
 * Sailcloth as a simulated fabric (view only; the forces on the ship come from the simulation's
 * sail model). Extended position-based dynamics (Macklin, Müller, Chentanez, "XPBD: Position-Based
 * Simulation of Compliant Constrained Dynamics", 2016, after Müller et al., "Position Based
 * Dynamics", 2007): particles on the sail's grid, moved by gravity and the wind's pressure, then
 * pulled back by distance constraints solved in place, each with its own compliance.
 *
 * How the sail is made decides how it behaves:
 * - It is bent to its spars: the head of a square sail to its yard with the clews sheeted home, a
 *   gaff sail to mast, gaff and boom, a jib to its stay with the clew on the sheet. Those particles
 *   follow the flat outline (`sailPositions`), also as the sail is taken in.
 * - The cloth is cut full: its threads are a few percent longer than the distance between the
 *   spars, so it has a belly to fill (about a tenth of the chord, as real sails).
 * - Canvas carries tension but buckles under compression: thread constraints only ever pull.
 * - The grid's columns are the sail's cloths (`SAIL_LAYOUT.cloths`): every column line is a flat
 *   seam, a doubled thickness that resists bending along its length; so do the reef bands across
 *   and the tabling round the edges. The sail therefore curves easily across its cloths and stays
 *   fair along them, which is what the seams of a real sail are for.
 *
 * Deterministic: fixed steps, no random numbers; the flutter of a luffing sail is excited by a
 * travelling sine field, not noise. We differ from the papers in leaving out self-collision and
 * collision with the rig (a sail aback lies through its mast): not worth the cost at this scale.
 */
const COLS = SAIL_COLS;
const ROWS = SAIL_ROWS;
const N = (COLS + 1) * (ROWS + 1);
const at = (r: number, c: number): number => r * (COLS + 1) + c;

/** Fixed step (s), solver passes per step, and the most steps taken for one frame. */
const STEP = 1 / 120;
const PASSES = 8;
const MAX_STEPS = 4;
/** How much longer than the flat outline the cloth is cut: across the cloths, and along them. */
const FULL_ACROSS = 0.032;
const FULL_ALONG = 0.012;
/** Weight of canvas (kg/m^2) and what a seam, a reef band or tabling adds to a particle on it. */
const CANVAS = 0.95;
const SEAM_WEIGHT = 1.25;
/** Compliances (m/N): threads, the bias, bending across the cloths, and along a seam or band. */
const THREAD = 5e-8;
const BIAS = 4e-5;
const BEND_SOFT = 6e-3;
const BEND_SEAM = 1.5e-5;
const DAMPING = 2.6;
const AIR = 1.225;

interface Link {
  readonly a: number;
  readonly b: number;
  /** Share of the flat distance at full set (rest length is rescaled as the sail is taken in). */
  readonly slack: number;
  readonly compliance: number;
  /** Threads only pull; bending links push and pull. */
  readonly pullOnly: boolean;
  /** Runs up the sail (shortens as the sail is gathered). */
  readonly along: boolean;
}

export class SailSim {
  /** Positions in sail space, laid out as `sailPositions` writes them. */
  readonly positions = new Float32Array(N * 3);
  private readonly prev = new Float32Array(N * 3);
  private readonly vel = new Float32Array(N * 3);
  private readonly flat = new Float32Array(N * 3);
  private readonly flatFull = new Float32Array(N * 3);
  private readonly inv = new Float32Array(N);
  private readonly pinned = new Uint8Array(N);
  private readonly links: Link[] = [];
  private readonly rest: Float32Array;
  /** The links again as flat arrays for the solver's inner loop (ends, compliance over h^2, pull-only). */
  private readonly la: Int16Array;
  private readonly lb: Int16Array;
  private readonly lc: Float32Array;
  private readonly lp: Uint8Array;
  private clock = 0;
  private pending = 0;
  private lastSet = -1;

  /** `seams`: false leaves the sewing out (plain canvas throughout), to compare what the seams do. */
  constructor(private readonly outline: SailOutline, seams = true) {
    const seamBend = seams ? BEND_SEAM : BEND_SOFT;
    sailPositions(outline, 1, 0, this.flatFull);
    const { reefBands } = SAIL_LAYOUT;
    const bandRow = (r: number): boolean => reefBands.some((v) => Math.round((1 - v) * ROWS) === r);
    const edge = (r: number, c: number): boolean => r === 0 || r === ROWS || c === 0 || c === COLS;
    const cell = (outline.width / COLS) * (outline.height / ROWS);
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        // Every column line is a seam; bands and tabling add their doubled canvas too.
        const mass = CANVAS * cell * (bandRow(r) || edge(r, c) ? SEAM_WEIGHT * 1.15 : SEAM_WEIGHT) * (edge(r, c) ? 0.6 : 1);
        this.inv[at(r, c)] = 1 / mass;
        this.pinned[at(r, c)] = this.isPinned(r, c) ? 1 : 0;
      }
    }
    const link = (a: number, b: number, slack: number, compliance: number, pullOnly: boolean, along: boolean): void => {
      this.links.push({ a, b, slack, compliance, pullOnly, along });
    };
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        if (c < COLS) link(at(r, c), at(r, c + 1), 1 + FULL_ACROSS, THREAD, true, false);
        if (r < ROWS) link(at(r, c), at(r + 1, c), 1 + FULL_ALONG, THREAD, true, true);
        if (c < COLS && r < ROWS) {
          link(at(r, c), at(r + 1, c + 1), 1 + (FULL_ACROSS + FULL_ALONG) / 2, BIAS, true, true);
          link(at(r, c + 1), at(r + 1, c), 1 + (FULL_ACROSS + FULL_ALONG) / 2, BIAS, true, true);
        }
        // Bending: across the cloths the canvas folds easily, except on a band or the tabling;
        // along a seam it is stiff everywhere.
        if (c + 2 <= COLS) link(at(r, c), at(r, c + 2), 1 + FULL_ACROSS * 0.5, bandRow(r) || r === 0 || r === ROWS ? seamBend : BEND_SOFT, false, false);
        if (r + 2 <= ROWS) link(at(r, c), at(r + 2, c), 1 + FULL_ALONG * 0.5, seamBend, false, true);
      }
    }
    this.rest = new Float32Array(this.links.length);
    this.la = Int16Array.from(this.links, (l) => l.a * 3);
    this.lb = Int16Array.from(this.links, (l) => l.b * 3);
    this.lc = Float32Array.from(this.links, (l) => l.compliance / (STEP * STEP));
    this.lp = Uint8Array.from(this.links, (l) => (l.pullOnly ? 1 : 0));
    // Pinned particles do not move: no inverse mass.
    for (let i = 0; i < N; i++) if (this.pinned[i]) this.inv[i] = 0;
    this.reset(1);
  }

  /** Which particles are made fast to a spar, a stay or a sheet. */
  private isPinned(r: number, c: number): boolean {
    const shape = this.outline.shape;
    if (shape === "square") return r === ROWS || (r === 0 && (c === 0 || c === COLS));
    if (shape === "gaff") return c === 0 || r === ROWS || r === 0;
    return c === 0 || (r === 0 && c === COLS);
  }

  /** Lays the cloth flat on its outline, at rest. */
  reset(set: number): void {
    this.reshape(set);
    this.positions.set(this.flat);
    this.prev.set(this.flat);
    this.vel.fill(0);
    this.pending = 0;
  }

  /** The outline and the threads' lengths for the share of the sail that is set. */
  private reshape(set: number): void {
    const s = Math.max(0.04, Math.min(1, set));
    if (Math.abs(s - this.lastSet) < 1e-4) return;
    this.lastSet = s;
    sailPositions(this.outline, s, 0, this.flat);
    this.links.forEach((l, i) => {
      const d = (k: number): number => this.flat[l.a * 3 + k]! - this.flat[l.b * 3 + k]!;
      this.rest[i] = Math.hypot(d(0), d(1), d(2)) * l.slack;
    });
  }

  /**
   * Advances the cloth by `dt` seconds in fixed steps.
   * @param set share of the sail spread (0..1)
   * @param drive signed fullness from the simulation (+ fills towards +x; about 0.3 to 1.2)
   * @param wind apparent wind speed (m/s)
   * @param flutter 0..1 how hard the sail is luffing
   */
  advance(dt: number, set: number, drive: number, wind: number, flutter: number): void {
    this.pending = Math.min(this.pending + Math.max(0, dt), STEP * MAX_STEPS);
    this.reshape(set);
    while (this.pending >= STEP) {
      this.pending -= STEP;
      this.step(drive, wind, flutter);
    }
  }

  private step(drive: number, wind: number, flutter: number): void {
    const p = this.positions;
    const h = STEP;
    this.clock += h;
    // Dynamic pressure of the apparent wind, scaled by how the simulation says the sail draws.
    const pressure = 0.5 * AIR * wind * wind * 1.2 * drive;
    const area = (this.outline.width / COLS) * ((this.outline.height * this.lastSet) / ROWS);
    const inv0 = this.inv;
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const i = at(r, c);
        const k = i * 3;
        if (this.pinned[i]) {
          for (let d = 0; d < 3; d++) {
            p[k + d] = this.flat[k + d]!;
            this.prev[k + d] = p[k + d]!;
            this.vel[k + d] = 0;
          }
          continue;
        }
        // The cloth's own normal here (central differences on the grid): the pressure acts along it.
        const cl = at(r, Math.max(0, c - 1)) * 3;
        const cr = at(r, Math.min(COLS, c + 1)) * 3;
        const rd = at(Math.max(0, r - 1), c) * 3;
        const ru = at(Math.min(ROWS, r + 1), c) * 3;
        const ux = p[cr]! - p[cl]!;
        const uy = p[cr + 1]! - p[cl + 1]!;
        const uz = p[cr + 2]! - p[cl + 2]!;
        const vx = p[ru]! - p[rd]!;
        const vy = p[ru + 1]! - p[rd + 1]!;
        const vz = p[ru + 2]! - p[rd + 2]!;
        let nx = vy * uz - vz * uy;
        let ny = vz * ux - vx * uz;
        let nz = vx * uy - vy * ux;
        const nl = Math.hypot(nx, ny, nz) || 1;
        // Oriented to +x on the flat sail (the grid may run either way along the chord).
        const sign = nx < 0 ? -1 : 1;
        nx = (nx / nl) * sign;
        ny = (ny / nl) * sign;
        nz = (nz / nl) * sign;
        // A luffing sail is shaken by eddies shed along it: a wave travelling from luff to leech.
        const shake = flutter * 0.5 * AIR * wind * wind * 0.5 * Math.sin((c / COLS) * Math.PI * 3 - this.clock * 11 + (r / ROWS) * 1.7) * (c / COLS);
        const f = (pressure + shake) * area * inv0[i]!;
        const damp = Math.max(0, 1 - DAMPING * h);
        this.vel[k] = (this.vel[k]! + f * nx * h) * damp;
        this.vel[k + 1] = (this.vel[k + 1]! + (f * ny - 9.81) * h) * damp;
        this.vel[k + 2] = (this.vel[k + 2]! + f * nz * h) * damp;
        for (let d = 0; d < 3; d++) {
          this.prev[k + d] = p[k + d]!;
          p[k + d] = p[k + d]! + this.vel[k + d]! * h;
        }
      }
    }
    const { la, lb, lc, lp, rest, inv } = this;
    const count = la.length;
    for (let pass = 0; pass < PASSES; pass++) {
      for (let li = 0; li < count; li++) {
        const a = la[li]!;
        const b = lb[li]!;
        const dx = p[b]! - p[a]!;
        const dy = p[b + 1]! - p[a + 1]!;
        const dz = p[b + 2]! - p[a + 2]!;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const err = len - rest[li]!;
        if (len < 1e-9 || (lp[li] === 1 && err <= 0)) continue;
        const wa = inv[a / 3]!;
        const wb = inv[b / 3]!;
        const w = wa + wb + lc[li]!;
        if (w <= 0) continue;
        const s = err / w / len;
        p[a] = p[a]! + dx * s * wa;
        p[a + 1] = p[a + 1]! + dy * s * wa;
        p[a + 2] = p[a + 2]! + dz * s * wa;
        p[b] = p[b]! - dx * s * wb;
        p[b + 1] = p[b + 1]! - dy * s * wb;
        p[b + 2] = p[b + 2]! - dz * s * wb;
      }
    }
    for (let i = 0; i < N * 3; i++) this.vel[i] = (p[i]! - this.prev[i]!) / h;
  }
}
