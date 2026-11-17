/**
 * Recorded sound (CC0 clips from OpenGameArt, built by tools/assets/audio.sh): a sample bank and an
 * ambience mixer. Loops of sea, light wind, storm wind, rain and storm run all the time and are
 * cross-faded by the weather where the listener is (the usual layered-ambience approach of game
 * audio: fixed beds, gains driven by game state, smoothed by setTargetAtTime). One-shots are
 * placed like the synthesised cues (distance law, stereo pan, delay by the speed of sound) and play
 * at a pitch varied per shot so a broadside does not sound like one gun repeated.
 */
export const CLIPS = [
  "sea", "wind_light", "wind_storm", "rain", "storm", "creak", "gulls", "shore", "gun", "hit", "splash", "ram", "sinking",
  // Shipboard (JC Sounds' Pirate Pack, CC BY 4.0; winch, CC0): deck bed, ropes, feet, boarding, the purse, the capstan.
  "deck", "rope1", "rope2", "rope3", "step1", "step2", "step3", "run1", "run2", "sword1", "sword2", "sword3", "pistol", "coins", "chest", "winch1", "winch2",
] as const;
export type ClipName = (typeof CLIPS)[number];

const LOOPS = ["sea", "wind_light", "wind_storm", "rain", "storm"] as const;
type LoopName = (typeof LOOPS)[number];

/** Weather at the listener, as the app reads it from the simulation. */
export interface Ambience {
  /** Wind speed (m/s) where the camera is. */
  readonly windSpeed: number;
  /** 0..1 rain. */
  readonly rain: number;
  /** 0..1 storm (gale, storm, a strong storm cell). */
  readonly storm: number;
  /** 0..1 how close the shore is (1: on the beach). */
  readonly land: number;
  /** 0..1 how hard the player's ship is working in the sea (heel and pitch). */
  readonly strain: number;
}

export class Soundscape {
  private readonly buffers = new Map<ClipName, AudioBuffer>();
  private readonly loopGains = new Map<LoopName, GainNode>();
  private nextCreak = 0;
  private nextGull = 0;
  private nextShore = 0;

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode, private readonly baseUrl: string) {}

  async load(): Promise<void> {
    await Promise.all(
      CLIPS.map(async (name) => {
        try {
          const res = await fetch(`${this.baseUrl}${name}.mp3`);
          this.buffers.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
          // Missing clip: the synthesised fallback plays instead.
        }
      }),
    );
    for (const name of LOOPS) {
      const buf = this.buffers.get(name);
      if (!buf) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.out);
      // Start each loop at its own offset so the beds never line up.
      src.start(0, (LOOPS.indexOf(name) * 7.3) % buf.duration);
      this.loopGains.set(name, g);
    }
  }

  /** A further looping bed (silent until its gain is raised), or null without its clip. */
  startLoop(name: ClipName): GainNode | null {
    const buf = this.buffers.get(name);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.out);
    src.start();
    return g;
  }

  get ready(): boolean {
    return this.loopGains.size > 0;
  }

  has(name: ClipName): boolean {
    return this.buffers.has(name);
  }

  /** Sets the beds for the weather at the listener and fires the occasional ship and shore sounds. */
  update(a: Ambience): void {
    const t = this.ctx.currentTime;
    const set = (name: LoopName, v: number, tc = 1.2): void => {
      this.loopGains.get(name)?.gain.setTargetAtTime(Math.max(0, v), t, tc);
    };
    const w = a.windSpeed;
    set("sea", 0.35 + Math.min(0.5, w / 30) - a.land * 0.15);
    set("wind_light", Math.min(0.5, w / 16) * (1 - Math.min(1, Math.max(0, (w - 10) / 8))));
    set("wind_storm", Math.min(0.9, Math.max(0, (w - 9) / 12)) + a.storm * 0.3);
    set("rain", a.rain * 0.8);
    set("storm", a.storm * 0.7);
    if (t > this.nextCreak) {
      this.nextCreak = t + 4 + Math.random() * 8 * (1.2 - a.strain);
      this.oneShot("creak", 0.15 + a.strain * 0.6, 0, 0.85 + Math.random() * 0.3);
    }
    if (a.land > 0.2 && t > this.nextGull) {
      this.nextGull = t + 12 + Math.random() * 20;
      this.oneShot("gulls", 0.25 * a.land, Math.random() * 1.6 - 0.8, 0.9 + Math.random() * 0.2);
    }
    if (a.land > 0.5 && t > this.nextShore) {
      this.nextShore = t + 3 + Math.random() * 4;
      this.oneShot("shore", 0.3 * a.land, Math.random() * 1.2 - 0.6, 0.9 + Math.random() * 0.2);
    }
  }

  /** A placed one-shot: gain, pan -1..1, playback rate (pitch), delay in seconds. */
  oneShot(name: ClipName, gain: number, pan: number, rate = 1, delay = 0): void {
    const buf = this.buffers.get(name);
    if (!buf || gain < 0.01) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g).connect(p).connect(this.out);
    src.start(this.ctx.currentTime + delay);
  }
}
