import { type Ambience, Soundscape } from "./soundscape";
import { ShipSounds } from "./ship-sounds";
import { type ShipAudioState } from "./ship-sound-plan";

/**
 * Game sound. Recorded CC0 clips when they are loaded (Soundscape: ambience beds and placed
 * one-shots), synthesis otherwise and for what has no clip. Subtractive synthesis on the
 * Web Audio API: filtered noise bursts and enveloped sine thumps for guns, splashes, wood and
 * explosions, a looping noise bed for wind and sea shaped by the weather. Sounds are placed by a
 * distance law (inverse distance, Web Audio's model) and stereo panning from the bearing.
 */
export interface Listener {
  readonly x: number;
  readonly z: number;
  /** Heading the listener faces (camera view), radians. */
  readonly heading: number;
}

export type Cue =
  | { readonly kind: "gun"; readonly x: number; readonly z: number; readonly size: number }
  | { readonly kind: "splash"; readonly x: number; readonly z: number; readonly size: number }
  | { readonly kind: "wood"; readonly x: number; readonly z: number; readonly size: number }
  | { readonly kind: "boom"; readonly x: number; readonly z: number; readonly size: number }
  | { readonly kind: "bell" }
  /** Coins counted into the chest (prize money, pay, sales). */
  | { readonly kind: "coins" }
  /** Steel on steel: a boarding fight. */
  | { readonly kind: "clash" }
  /** The capstan turning: kedging off a shoal, weighing anchor. */
  | { readonly kind: "capstan" }
  /** A sea chest opened: a bargain struck ashore. */
  | { readonly kind: "chest" };

const REF_DISTANCE = 40;

export class SynthAudio {
  private ctx: AudioContext | null = null;
  private scape: Soundscape | null = null;
  private ship: ShipSounds | null = null;

  /** `clipsUrl`: where the recorded clips lie (`<url><name>.mp3`); omitted, everything is synthesised. */
  constructor(private readonly clipsUrl?: string) {}

  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private windGain: GainNode | null = null;
  private seaGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  /** Browsers start audio only after a user gesture: call from the first input. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    // Long enough that the ear does not catch the loop (two seconds of noise repeat audibly).
    this.noise = this.makeNoise(9);
    this.startBeds();
    if (this.clipsUrl) {
      this.scape = new Soundscape(this.ctx, this.master, this.clipsUrl);
      void this.scape.load();
    }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // A fixed linear congruential sequence: the same noise every time (deterministic assets).
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      d[i] = (s / 4294967296) * 2 - 1;
    }
    return buf;
  }

  private loop(filterType: BiquadFilterType, freq: number, q: number): { gain: GainNode; filter: BiquadFilterNode } {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    return { gain, filter };
  }

  private startBeds(): void {
    const wind = this.loop("bandpass", 600, 0.6);
    this.windGain = wind.gain;
    this.windFilter = wind.filter;
    this.seaGain = this.loop("lowpass", 380, 0.5).gain;
  }

  /** Weather at the listener: recorded beds when loaded, the noise beds otherwise. */
  setAmbience(a: Ambience): void {
    if (this.scape?.ready) {
      this.scape.update(a);
      this.setWeather(0, 0);
      return;
    }
    this.setWeather(a.windSpeed, 0.5);
  }

  /** The player's ship as heard aboard (ropes, deck, canvas, bell, water along the side): needs the clips. */
  setShip(state: ShipAudioState): void {
    if (!this.ctx || !this.master || !this.noise || !this.scape?.ready) return;
    this.ship ??= new ShipSounds(this.ctx, this.master, this.scape, this.noise);
    this.ship.update(state);
  }

  /** Noise bed: wind in m/s, a gust factor 0..1. */
  setWeather(windSpeed: number, gust: number): void {
    if (!this.ctx || !this.windGain || !this.seaGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(Math.min(0.5, windSpeed / 40) * (0.7 + 0.3 * gust), t, 0.5);
    this.windFilter.frequency.setTargetAtTime(350 + windSpeed * 40 + gust * 300, t, 0.5);
    this.seaGain.gain.setTargetAtTime(0.12 + Math.min(0.35, windSpeed / 50), t, 0.8);
  }

  private place(x: number, z: number, l: Listener): { gain: number; pan: number; delay: number } {
    const dx = x - l.x;
    const dz = z - l.z;
    const d = Math.hypot(dx, dz);
    const gain = REF_DISTANCE / Math.max(REF_DISTANCE, d);
    const bearing = Math.atan2(dx, dz) - l.heading;
    // Sound travels at 343 m/s: a distant gun is heard after its flash.
    return { gain, pan: Math.sin(bearing), delay: d / 343 };
  }

  private burst(at: { gain: number; pan: number; delay: number }, type: BiquadFilterType, freq: number, dur: number, level: number, thump: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + at.delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.25), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level * at.gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = at.pan;
    src.connect(f).connect(g).connect(pan).connect(this.master!);
    src.start(t0, Math.random(), dur + 0.1);
    if (thump > 0) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(70, t0);
      o.frequency.exponentialRampToValueAtTime(32, t0 + dur * 0.6);
      const og = ctx.createGain();
      og.gain.setValueAtTime(thump * at.gain, t0);
      og.gain.exponentialRampToValueAtTime(0.0005, t0 + dur * 0.7);
      o.connect(og).connect(pan);
      o.start(t0);
      o.stop(t0 + dur);
    }
  }

  play(cue: Cue, l: Listener): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (cue.kind === "bell") return this.bell();
    if (cue.kind === "coins" || cue.kind === "clash" || cue.kind === "capstan" || cue.kind === "chest") return this.playNear(cue.kind);
    const at = this.place(cue.x, cue.z, l);
    if (at.gain < 0.03) return;
    if (this.playRecorded(cue, at)) return;
    if (cue.kind === "gun") this.burst(at, "lowpass", 900 + 600 / cue.size, 1.1 + cue.size * 0.5, 0.9, 0.9 * cue.size);
    else if (cue.kind === "splash") this.burst(at, "bandpass", 1400, 0.6 * cue.size, 0.25, 0);
    else if (cue.kind === "wood") this.burst(at, "highpass", 1800, 0.25, 0.5, 0.2);
    else this.burst(at, "lowpass", 600, 2.2 * cue.size, 1, 1.2);
  }

  /** Sounds heard at the listener's own ship: recorded when the clips are loaded, synthesised otherwise. */
  private playNear(kind: "coins" | "clash" | "capstan" | "chest"): void {
    const s = this.scape;
    const rate = (): number => 0.92 + Math.random() * 0.16;
    if (kind === "coins") return s?.has("coins") ? s.oneShot("coins", 0.7, 0, rate()) : this.coins();
    if (kind === "clash") {
      if (!s?.has("sword1")) return this.clash();
      // A boarding fight: blades from both sides, then pistols.
      (["sword1", "sword2", "sword3", "sword1", "sword2"] as const).forEach((c, i) => s.oneShot(c, 0.6, i % 2 ? 0.4 : -0.4, rate(), i * 0.28));
      s.oneShot("pistol", 0.7, -0.3, rate(), 0.5);
      s.oneShot("pistol", 0.55, 0.5, rate(), 1.25);
      return;
    }
    if (kind === "capstan") {
      s?.oneShot("winch1", 0.6, 0, rate());
      s?.oneShot("winch1", 0.6, 0, rate(), 3.4);
      return;
    }
    s?.oneShot("chest", 0.6, 0, rate());
  }

  /** A few bright pings with a short decay, staggered (coins dropping onto a pile). */
  private coins(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    [3150, 2620, 3480, 2890, 3720].forEach((f, i) => {
      const t = t0 + i * 0.06;
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + 0.2);
    });
  }

  /** Ringing metal hits: band-passed noise bursts with an inharmonic ring, repeated. */
  private clash(): void {
    const near = { gain: 0.8, pan: 0, delay: 0 };
    for (let i = 0; i < 4; i++) {
      const at = { ...near, delay: i * 0.17, pan: i % 2 ? 0.3 : -0.3 };
      this.burst(at, "bandpass", 3200 - i * 300, 0.22, 0.35, 0);
    }
  }

  /** Recorded version of a placed cue, if its clip is loaded (pitch varied per shot, lower for bigger guns). */
  private playRecorded(cue: Cue, at: { gain: number; pan: number; delay: number }): boolean {
    const s = this.scape;
    if (!s || !("size" in cue)) return false;
    const jitter = 0.94 + Math.random() * 0.12;
    if (cue.kind === "gun" && s.has("gun")) s.oneShot("gun", at.gain * Math.min(1.2, 0.5 + cue.size * 0.5), at.pan, jitter / Math.pow(Math.max(0.3, cue.size), 0.25), at.delay);
    else if (cue.kind === "splash" && s.has("splash")) s.oneShot("splash", at.gain * Math.min(1, 0.3 + cue.size * 0.3), at.pan, jitter, at.delay);
    else if (cue.kind === "wood" && s.has("hit")) s.oneShot(cue.size > 1.5 ? "ram" : "hit", at.gain * Math.min(1, 0.4 + cue.size * 0.3), at.pan, jitter, at.delay);
    else return false;
    return true;
  }

  private bell(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    for (const [f, a] of [[880, 0.2], [1320, 0.08], [2210, 0.04]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(a, t0);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.6);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 1.7);
    }
  }
}
