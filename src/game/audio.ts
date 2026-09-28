export type SoundName = 'launch' | 'push' | 'hop' | 'bounce' | 'bump' | 'boost' | 'boom' | 'sheep' | 'loop' | 'finish' | 'land' | 'pickup' | 'shield' | 'thud'
  | 'tree_smash' | 'rope_reel' | 'go' | 'lane_clunk';

/**
 * P9: slow motion is heard, not just seen. At a time scale s every sound plays at pitch s^0.4 and
 * lasts 1 / s^0.6 as long: half speed is a deeper, longer groan, never a chipmunk.
 */
export function slowMotionAudio(timeScale: number): { pitch: number; stretch: number } {
  const s = Number.isFinite(timeScale) && timeScale > 0 ? Math.min(1, timeScale) : 1;
  return { pitch: s ** 0.4, stretch: 1 / s ** 0.6 };
}

/** H8: the thud's shape: a sine sweeping 140 → 35 Hz under a short low-passed noise burst. */
export const THUD = Object.freeze({ fromHz: 140, toHz: 35, seconds: 0.24, noiseSeconds: 0.06, lowpassHz: 220, peak: 0.3 });

export class GameAudio {
  private context: AudioContext | null = null;
  private enabled = false;
  private volume = 0.65;
  /** P9: the race's time scale, so the sounds slow down with it. */
  private timeScale = 1;

  setTimeScale(scale: number) { this.timeScale = scale; }

  /** P9: one oscillator note, pitched and stretched for slow motion. */
  private tone(context: AudioContext, type: OscillatorType, fromHz: number, toHz: number, seconds: number, peak: number, delay = 0, attack = 0.005) {
    const { pitch, stretch } = slowMotionAudio(this.timeScale);
    const start = context.currentTime + delay * stretch; const length = seconds * stretch;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromHz * pitch, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, toHz * pitch), start + length);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + Math.min(length * 0.5, attack * stretch));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start); oscillator.stop(start + length);
  }

  /** P9: a filtered noise burst, pitched (its filter) and stretched for slow motion. */
  private noise(context: AudioContext, seconds: number, filter: BiquadFilterType, hz: number, peak: number, delay = 0) {
    const { pitch, stretch } = slowMotionAudio(this.timeScale);
    const start = context.currentTime + delay * stretch; const length = seconds * stretch;
    const buffer = context.createBuffer(1, Math.max(1, Math.ceil(context.sampleRate * length)), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const shape = context.createBiquadFilter();
    shape.type = filter;
    shape.frequency.setValueAtTime(hz * pitch, start);
    const gain = context.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, peak), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(shape).connect(gain).connect(context.destination);
    source.start(start); source.stop(start + length);
  }

  setVolume(value: number) { this.volume = Math.max(0, Math.min(1, value / 100)); }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.unlock();
  }

  unlock() {
    if (!this.enabled || this.volume === 0) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      this.enabled = false;
    }
  }

  /** `gain` (0..1) scales this one play: a light knock is quieter than a heavy one. */
  play(name: SoundName, gain = 1) {
    if (!this.enabled || this.volume === 0) return;
    this.unlock();
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    const level = Math.max(0, Math.min(1, gain)) * this.volume;
    const { pitch, stretch } = slowMotionAudio(this.timeScale);

    if (name === 'thud') {
      // H8: the body of a hit — a falling low sine for the weight, a burst of low-passed noise for
      // the contact.
      this.tone(context, 'sine', THUD.fromHz, THUD.toHz, THUD.seconds, THUD.peak * level);
      this.noise(context, THUD.noiseSeconds, 'lowpass', THUD.lowpassHz, THUD.peak * 0.8 * level);
      return;
    }
    if (name === 'tree_smash') {
      // P9: splintering wood: a bright crack, then the hollow knock of the trunk.
      this.noise(context, 0.12, 'highpass', 1800, 0.22 * level);
      this.noise(context, 0.2, 'bandpass', 700, 0.14 * level, 0.02);
      this.tone(context, 'sine', 95, 42, 0.28, 0.24 * level, 0.03);
      return;
    }
    if (name === 'rope_reel') {
      // P9: the winch ratchet: eight quick metal teeth, fading as the rope comes taut.
      for (let tooth = 0; tooth < 8; tooth++) this.tone(context, 'square', 1250, 900, 0.014, 0.05 * level * (1 - tooth / 10), tooth * 0.036, 0.001);
      return;
    }
    if (name === 'go') {
      // P9: a brass horn: a fifth held on two saws through a warm filter.
      this.tone(context, 'sawtooth', 196, 196, 0.8, 0.05 * level, 0, 0.04);
      this.tone(context, 'sawtooth', 294, 294, 0.8, 0.04 * level, 0, 0.05);
      this.tone(context, 'triangle', 392, 392, 0.6, 0.03 * level, 0.02, 0.04);
      return;
    }
    if (name === 'lane_clunk') {
      // P9: iron on iron and a creak of suspension.
      this.tone(context, 'triangle', 180, 90, 0.08, 0.07 * level);
      this.noise(context, 0.035, 'lowpass', 600, 0.06 * level);
      return;
    }

    if (name === 'boom') {
      const buffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800 * pitch, now);
      filter.frequency.exponentialRampToValueAtTime(70 * pitch, now + 0.5 * stretch);
      const volume = context.createGain();
      volume.gain.setValueAtTime(Math.max(0.001, 0.22 * level), now);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.5 * stretch);
      source.connect(filter).connect(volume).connect(context.destination);
      source.start();
      source.stop(now + 0.5 * stretch);
      return;
    }

    const notes: Record<Exclude<SoundName, 'boom' | 'thud' | 'tree_smash' | 'rope_reel' | 'go' | 'lane_clunk'>, [number, number, number, OscillatorType]> = {
      launch: [490, 85, 0.3, 'sawtooth'],
      // M01 · T1: the starter goblin's shove — lower, shorter and blunter than the sling.
      push: [210, 430, 0.22, 'square'],
      hop: [130, 310, 0.12, 'sine'],
      bounce: [170, 620, 0.24, 'sine'],
      bump: [420, 85, 0.16, 'triangle'],
      boost: [95, 420, 0.36, 'sawtooth'],
      sheep: [350, 190, 0.36, 'square'],
      loop: [340, 980, 0.45, 'sine'],
      finish: [420, 840, 0.7, 'triangle'],
      land: [100, 38, 0.1, 'sine'],
      pickup: [520, 1060, 0.2, 'triangle'],
      shield: [850, 220, 0.25, 'sine'],
    };
    const [start, end, duration, type] = notes[name];
    this.tone(context, type, start, end, duration, (name === 'sheep' ? 0.035 : 0.055) * level, 0, 0.02);
  }

  destroy() {
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}