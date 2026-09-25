export type SoundName = 'launch' | 'push' | 'hop' | 'bounce' | 'bump' | 'boost' | 'boom' | 'sheep' | 'loop' | 'finish' | 'land' | 'pickup' | 'shield' | 'thud';

/** H8: the thud's shape: a sine sweeping 140 → 35 Hz under a short low-passed noise burst. */
export const THUD = Object.freeze({ fromHz: 140, toHz: 35, seconds: 0.24, noiseSeconds: 0.06, lowpassHz: 220, peak: 0.3 });

export class GameAudio {
  private context: AudioContext | null = null;
  private enabled = false;
  private volume = 0.65;

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

    if (name === 'thud') {
      // H8: the body of a hit — a falling low sine for the weight, a burst of low-passed noise for
      // the contact.
      const body = context.createOscillator();
      body.type = 'sine';
      body.frequency.setValueAtTime(THUD.fromHz, now);
      body.frequency.exponentialRampToValueAtTime(THUD.toHz, now + THUD.seconds);
      const bodyGain = context.createGain();
      bodyGain.gain.setValueAtTime(Math.max(0.0001, THUD.peak * level), now);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + THUD.seconds);
      body.connect(bodyGain).connect(context.destination);
      body.start(); body.stop(now + THUD.seconds);
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * THUD.noiseSeconds), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(THUD.lowpassHz, now);
      const noiseGain = context.createGain();
      noiseGain.gain.setValueAtTime(Math.max(0.0001, THUD.peak * 0.8 * level), now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + THUD.noiseSeconds);
      noise.connect(filter).connect(noiseGain).connect(context.destination);
      noise.start(); noise.stop(now + THUD.noiseSeconds);
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
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(70, now + 0.5);
      const volume = context.createGain();
      volume.gain.setValueAtTime(Math.max(0.001, 0.22 * level), now);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      source.connect(filter).connect(volume).connect(context.destination);
      source.start();
      source.stop(now + 0.5);
      return;
    }

    const notes: Record<Exclude<SoundName, 'boom' | 'thud'>, [number, number, number, OscillatorType]> = {
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
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(Math.max(0.0001, (name === 'sheep' ? 0.035 : 0.055) * level), now + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(volume).connect(context.destination);
    oscillator.start();
    oscillator.stop(now + duration);
  }

  destroy() {
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}