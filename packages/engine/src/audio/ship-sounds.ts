import { type Soundscape } from "./soundscape";
import { type ShipAudioState, type ShipShot, newShipSoundMemory, planShipSounds } from "./ship-sound-plan";

/**
 * Plays what the ship-sound director decides (ship-sound-plan): the recorded deck bed and clips
 * through the Soundscape, and synthesised voices where no recording serves: water along the side
 * (band-limited noise), the wind in the rigging (two narrow noise bands at the aeolian tone and
 * its octave, slowly wavering), canvas flapping and cracking, a gun carriage rumbling on the deck,
 * and the ship's bell (three partials, as SynthAudio's notice bell but struck harder and lower).
 */
export class ShipSounds {
  private readonly memory = newShipSoundMemory();
  private readonly wash: { gain: GainNode; filter: BiquadFilterNode };
  private readonly rig: { gain: GainNode; filters: BiquadFilterNode[] };
  private readonly deck: GainNode | null;
  private last = 0;

  /** Where another ship's sounds come from (-1..1); null: the own ship, all round the listener. */
  pan: number | null = null;

  /** `own`: the listener's own ship (with the deck's creaking bed); else another ship close by, heard from one side. */
  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode, private readonly scape: Soundscape, private readonly noise: AudioBuffer, own = true) {
    const bed = (): AudioBufferSourceNode => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.start();
      return src;
    };
    const washFilter = ctx.createBiquadFilter();
    washFilter.type = "lowpass";
    const washGain = ctx.createGain();
    washGain.gain.value = 0;
    bed().connect(washFilter).connect(washGain).connect(out);
    this.wash = { gain: washGain, filter: washFilter };
    const rigGain = ctx.createGain();
    rigGain.gain.value = 0;
    rigGain.connect(out);
    const filters = [1, 2].map((octave) => {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 28;
      const g = ctx.createGain();
      // A resonant band of noise is quiet: make it up, the octave softer.
      g.gain.value = 9 / octave;
      bed().connect(f).connect(g).connect(rigGain);
      return f;
    });
    this.rig = { gain: rigGain, filters };
    this.deck = own ? scape.startLoop("deck") : null;
  }

  update(state: ShipAudioState): void {
    const t = this.ctx.currentTime;
    const dt = Math.min(0.5, this.last === 0 ? 0 : t - this.last);
    this.last = t;
    const plan = planShipSounds(state, this.memory, dt, Math.random);
    this.deck?.gain.setTargetAtTime(plan.deck, t, 0.8);
    this.wash.gain.gain.setTargetAtTime(plan.wash, t, 0.6);
    this.wash.filter.frequency.setTargetAtTime(plan.washTone, t, 0.6);
    this.rig.gain.gain.setTargetAtTime(plan.rig, t, 1.5);
    // The tone wavers a little, as the wind does (a slow sine, a few percent).
    const waver = 1 + 0.04 * Math.sin(t * 0.9);
    this.rig.filters.forEach((f, i) => f.frequency.setTargetAtTime(Math.max(60, plan.rigTone * (i + 1) * waver), t, 0.8));
    for (const s of plan.shots) this.play(s);
  }

  private play(shot: ShipShot): void {
    const s = this.pan === null ? shot : { ...shot, pan: this.pan };
    if (s.voice === "flap") this.burst(s, "lowpass", 420 * s.rate, 0.16, 0.25);
    else if (s.voice === "crack") this.burst(s, "bandpass", 900 * s.rate, 0.09, 0.9);
    else if (s.voice === "crackle") this.burst(s, "highpass", 2600 * s.rate, 0.035, 0.7);
    else if (s.voice === "rumble") this.burst(s, "lowpass", 140 * s.rate, 0.8, 0.5);
    else if (s.voice === "bell") this.bell(s);
    else if (s.voice === "pipe") this.pipe(s);
    else this.scape.oneShot(s.voice, s.gain, s.pan, s.rate, s.delay);
  }

  /** A burst of filtered noise with a fast attack and an exponential tail of `dur` seconds. */
  private burst(s: ShipShot, type: BiquadFilterType, freq: number, dur: number, level: number): void {
    const t0 = this.ctx.currentTime + s.delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0005, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, s.gain * level), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    const p = this.ctx.createStereoPanner();
    p.pan.value = s.pan;
    src.connect(f).connect(g).connect(p).connect(this.out);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  /**
   * The boatswain's call: a small whistle's pure high note that swoops up, holds, and ends in a
   * trill (the call "haul away"), a sine with its pitch ramped and then warbled.
   */
  private pipe(s: ShipShot): void {
    const t0 = this.ctx.currentTime + s.delay;
    const o = this.ctx.createOscillator();
    const base = 2200 * s.rate;
    o.frequency.setValueAtTime(base, t0);
    o.frequency.exponentialRampToValueAtTime(base * 1.3, t0 + 0.25);
    o.frequency.setValueAtTime(base * 1.3, t0 + 0.55);
    for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(base * (i % 2 ? 1.18 : 1.3), t0 + 0.55 + i * 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0005, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.12 * s.gain), t0 + 0.05);
    g.gain.setValueAtTime(0.12 * s.gain, t0 + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.95);
    const p = this.ctx.createStereoPanner();
    p.pan.value = s.pan;
    o.connect(g).connect(p).connect(this.out);
    o.start(t0);
    o.stop(t0 + 1);
  }

  /** The ship's bell: a struck bronze bell of about 30 cm, hum, prime and two upper partials. */
  private bell(s: ShipShot): void {
    const t0 = this.ctx.currentTime + s.delay;
    for (const [f, a, d] of [[620, 0.5, 2.4], [1240, 0.3, 1.6], [1850, 0.16, 1.1], [2630, 0.08, 0.7]] as const) {
      const o = this.ctx.createOscillator();
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(a * s.gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + d);
      o.connect(g).connect(this.out);
      o.start(t0);
      o.stop(t0 + d + 0.05);
    }
  }
}
