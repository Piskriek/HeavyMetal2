export type SoundName = 'launch' | 'push' | 'hop' | 'bounce' | 'bump' | 'boost' | 'boom' | 'sheep' | 'loop' | 'finish' | 'land' | 'pickup' | 'shield';

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

  play(name: SoundName) {
    if (!this.enabled || this.volume === 0) return;
    this.unlock();
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;

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
      volume.gain.setValueAtTime(Math.max(0.001, 0.22 * this.volume), now);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      source.connect(filter).connect(volume).connect(context.destination);
      source.start();
      source.stop(now + 0.5);
      return;
    }

    const notes: Record<Exclude<SoundName, 'boom'>, [number, number, number, OscillatorType]> = {
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
    volume.gain.exponentialRampToValueAtTime(Math.max(0.0001, (name === 'sheep' ? 0.035 : 0.055) * this.volume), now + 0.02);
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