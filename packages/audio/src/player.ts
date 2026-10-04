import { SFX, type SfxId, type SfxRecipe } from './recipes.js';
import { type EngineParams, type RollParams } from './engine.js';
import { type MusicPattern } from './music.js';

export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  cancelScheduledValues?(t: number): unknown;
}

export interface AudioNodeLike {
  connect(dest: unknown): unknown;
  disconnect?(): unknown;
}

export interface OscLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  detune: AudioParamLike;
  start(t?: number): void;
  stop(t?: number): void;
}

export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface FilterLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  Q: AudioParamLike;
}

export interface BufferLike {
  getChannelData(c: number): Float32Array;
}

export interface BufferSourceLike extends AudioNodeLike {
  buffer: unknown;
  loop: boolean;
  start(t?: number): void;
  stop(t?: number): void;
}

export interface AudioContextLike {
  currentTime: number;
  sampleRate: number;
  destination: unknown;
  state?: string;
  resume?(): unknown;
  close?(): unknown;
  createOscillator(): OscLike;
  createGain(): GainLike;
  createBiquadFilter(): FilterLike;
  createBuffer(channels: number, length: number, rate: number): BufferLike;
  createBufferSource(): BufferSourceLike;
}

export interface AudioEngine {
  resume(): void;
  playSfx(id: SfxId, o?: { volume?: number; pitch?: number /* multiplier */ }): void;
  /** Play any recipe (an edited or randomized sound preset), not just a built-in id. */
  playRecipe(recipe: PlayableRecipe, o?: { volume?: number; pitch?: number }): void;
  setEngine(key: string, p: EngineParams): void;
  stopEngine(key: string): void;
  setRoll(key: string, p: RollParams): void;
  /** An ambience bed (a forest, wind, rain ...): looping synth layers at `gain`; it fades to each new gain, and 0 fades it out and stops it. */
  setBed(key: string, layers: readonly AmbienceLayer[], gain: number): void;
  playMusic(p: MusicPattern): void;
  stopMusic(): void;
  setVolumes(v: Partial<{ master: number; sfx: number; music: number }>): void;
  readonly volumes: { master: number; sfx: number; music: number };
  dispose(): void;
}

/** One layer of an ambience bed (the shape of @hm/soundscape's Layer): a wave or noise, its level, a slow wobble, a filter. */
export interface AmbienceLayer { readonly wave: 'sine' | 'triangle' | 'noise'; readonly freq: number; readonly gain: number; readonly lfoHz: number; readonly lfoDepth: number; readonly filter: 'lowpass' | 'bandpass' | 'highpass'; readonly cutoff: number }

/** The part of a recipe the player needs (sound presets may carry any id). */
export type PlayableRecipe = Pick<SfxRecipe, 'layers'> & { readonly durationMs?: number };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampFreq(f: number): number {
  return clamp(f, 20, 20000);
}

export function createAudioEngine(
  ctx: AudioContextLike | null,
  opts?: { master?: number; sfx?: number; music?: number },
): AudioEngine {
  const vol = {
    master: clamp(opts?.master ?? 1, 0, 1),
    sfx: clamp(opts?.sfx ?? 1, 0, 1),
    music: clamp(opts?.music ?? 1, 0, 1),
  };

  if (!ctx) {
    return {
      resume: () => {},
      playSfx: () => {},
      playRecipe: () => {},
      setEngine: () => {},
      stopEngine: () => {},
      setRoll: () => {},
      setBed: () => {},
      playMusic: () => {},
      stopMusic: () => {},
      setVolumes: (v) => {
        if (v.master !== undefined) vol.master = clamp(v.master, 0, 1);
        if (v.sfx !== undefined) vol.sfx = clamp(v.sfx, 0, 1);
        if (v.music !== undefined) vol.music = clamp(v.music, 0, 1);
      },
      get volumes() {
        return { ...vol };
      },
      dispose: () => {},
    };
  }

  // Create buses
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(vol.master, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const sfxGain = ctx.createGain();
  sfxGain.gain.setValueAtTime(vol.sfx, ctx.currentTime);
  sfxGain.connect(masterGain);

  const musicGain = ctx.createGain();
  musicGain.gain.setValueAtTime(vol.music, ctx.currentTime);
  musicGain.connect(masterGain);

  // Cached 1-second white-noise buffer
  let noiseBuf: BufferLike | null = null;
  function getNoiseBuffer(): BufferLike {
    if (!noiseBuf) {
      const len = ctx!.sampleRate || 48000;
      const b = ctx!.createBuffer(1, len, len);
      const data = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5; // (in fake or browser)
      }
      noiseBuf = b;
    }
    return noiseBuf;
  }

  // Ambience beds: persistent per key until faded out
  const bedMap = new Map<string, { out: GainLike; parts: { stop(t?: number): void }[] }>();

  // Engine state: persistent per-key
  interface EngineVoice {
    osc: OscLike;
    oscGain: GainLike;
    noise: BufferSourceLike;
    noiseGain: GainLike;
    filter: FilterLike;
  }
  const engineMap = new Map<string, EngineVoice>();

  // Roll state: persistent per-key
  interface RollVoice {
    noise: BufferSourceLike;
    gain: GainLike;
    filter: FilterLike;
  }
  const rollMap = new Map<string, RollVoice>();

  // Music scheduled nodes for stopping
  const musicNodes: { stop(t?: number): void; disconnect?(): unknown }[] = [];

  function stopAllMusic() {
    const t = ctx!.currentTime;
    for (const node of musicNodes) {
      try {
        node.stop(t);
        node.disconnect?.();
      } catch {
        // already stopped
      }
    }
    musicNodes.length = 0;
  }

  return {
    resume() {
      if (ctx.resume) ctx.resume();
    },

    playSfx(id: SfxId, o?: { volume?: number; pitch?: number }) {
      const recipe = SFX[id];
      if (!recipe) return;
      this.playRecipe(recipe, o);
    },

    playRecipe(recipe: PlayableRecipe, o?: { volume?: number; pitch?: number }) {
      if (!recipe || !Array.isArray(recipe.layers)) return;

      const userVol = o?.volume !== undefined ? Math.max(0, o.volume) : 1;
      const pitch = o?.pitch !== undefined && o.pitch > 0 ? o.pitch : 1;
      const t0 = ctx.currentTime;

      for (const layer of recipe.layers) {
        const delay = (layer.delayMs ?? 0) / 1000;
        const startT = t0 + delay;
        const attack = layer.attackMs / 1000;
        const decay = layer.decayMs / 1000;
        const peakT = startT + attack;
        const endT = peakT + decay;
        const targetGain = Math.max(0.0001, layer.gain * userVol);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, startT);
        gainNode.gain.linearRampToValueAtTime(targetGain, peakT);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endT);

        let sourceNode: OscLike | BufferSourceLike;

        if (layer.wave === 'noise') {
          const bs = ctx.createBufferSource();
          bs.buffer = getNoiseBuffer();
          bs.loop = true;
          sourceNode = bs;
        } else {
          const osc = ctx.createOscillator();
          osc.type = layer.wave;
          if (layer.detune) {
            osc.detune.setValueAtTime(layer.detune, startT);
          }
          const f0 = clampFreq(layer.freq[0] * pitch);
          const f1 = clampFreq(layer.freq[1] * pitch);
          osc.frequency.setValueAtTime(f0, startT);
          if (f0 !== f1 && decay > 0) {
            osc.frequency.exponentialRampToValueAtTime(f1, endT);
          }
          sourceNode = osc;
        }

        // Optional filter
        let finalNode: AudioNodeLike = sourceNode;
        if (layer.filter) {
          const flt = ctx.createBiquadFilter();
          flt.type = layer.filter.type;
          flt.Q.setValueAtTime(layer.filter.q, startT);
          const filtF0 = clampFreq(layer.filter.freq[0] * pitch);
          const filtF1 = clampFreq(layer.filter.freq[1] * pitch);
          flt.frequency.setValueAtTime(filtF0, startT);
          if (filtF0 !== filtF1 && decay > 0) {
            flt.frequency.exponentialRampToValueAtTime(filtF1, endT);
          }
          sourceNode.connect(flt);
          finalNode = flt;
        }

        finalNode.connect(gainNode);
        gainNode.connect(sfxGain);

        sourceNode.start(startT);
        sourceNode.stop(endT + 0.05);
      }
    },

    setEngine(key: string, p: EngineParams) {
      let voice = engineMap.get(key);
      const t = ctx.currentTime;
      if (!voice) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(p.freq, t);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(p.gain, t);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(p.filterFreq, t);

        const noise = ctx.createBufferSource();
        noise.buffer = getNoiseBuffer();
        noise.loop = true;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(p.noiseGain, t);

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(sfxGain);

        noise.connect(noiseGain);
        noiseGain.connect(sfxGain);

        osc.start(t);
        noise.start(t);

        voice = { osc, oscGain, noise, noiseGain, filter };
        engineMap.set(key, voice);
      } else {
        voice.osc.frequency.linearRampToValueAtTime(clampFreq(p.freq), t + 0.05);
        voice.oscGain.gain.linearRampToValueAtTime(clamp(p.gain, 0, 1), t + 0.05);
        voice.filter.frequency.linearRampToValueAtTime(clampFreq(p.filterFreq), t + 0.05);
        voice.noiseGain.gain.linearRampToValueAtTime(clamp(p.noiseGain, 0, 1), t + 0.05);
      }
    },

    stopEngine(key: string) {
      const voice = engineMap.get(key);
      if (voice) {
        const t = ctx.currentTime;
        voice.osc.stop(t);
        voice.noise.stop(t);
        voice.osc.disconnect?.();
        voice.noise.disconnect?.();
        engineMap.delete(key);
      }
    },

    setBed(key: string, layers: readonly AmbienceLayer[], gain: number) {
      const t = ctx.currentTime;
      const g = clamp(gain, 0, 1);
      let bed = bedMap.get(key);
      if (!bed) {
        if (g <= 0.001) return;
        const out = ctx.createGain();
        out.gain.setValueAtTime(0, t);
        out.connect(sfxGain);
        const parts: { stop(t?: number): void }[] = [];
        for (const l of layers) {
          const level = clamp(l.gain, 0, 1), depth = clamp(l.lfoDepth, 0, 1);
          let src: OscLike | BufferSourceLike;
          if (l.wave === 'noise') { const n = ctx.createBufferSource(); n.buffer = getNoiseBuffer(); n.loop = true; src = n; }
          else { const o = ctx.createOscillator(); o.type = l.wave; o.frequency.setValueAtTime(clampFreq(l.freq), t); src = o; }
          const filter = ctx.createBiquadFilter();
          filter.type = l.filter;
          filter.frequency.setValueAtTime(clampFreq(l.cutoff), t);
          // the wobble swings the layer's level between level * (1 - depth) and level
          const lg = ctx.createGain();
          lg.gain.setValueAtTime(level * (1 - depth / 2), t);
          src.connect(filter); filter.connect(lg); lg.connect(out);
          src.start(t); parts.push(src);
          if (l.lfoHz > 0 && depth > 0) {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(Math.min(20, l.lfoHz), t);
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime((level * depth) / 2, t);
            lfo.connect(lfoGain); lfoGain.connect(lg.gain);
            lfo.start(t); parts.push(lfo);
          }
        }
        bed = { out, parts };
        bedMap.set(key, bed);
      }
      bed.out.gain.cancelScheduledValues?.(t);
      bed.out.gain.setValueAtTime(bed.out.gain.value, t);
      bed.out.gain.linearRampToValueAtTime(g, t + 0.3);
      if (g <= 0.001) {
        for (const p of bed.parts) { try { p.stop(t + 0.35); } catch { /* already stopped */ } }
        bedMap.delete(key);
      }
    },

    setRoll(key: string, p: RollParams) {
      let voice = rollMap.get(key);
      const t = ctx.currentTime;
      if (!voice) {
        const noise = ctx.createBufferSource();
        noise.buffer = getNoiseBuffer();
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(p.filterFreq, t);
        filter.Q.setValueAtTime(p.q, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(p.gain, t);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);

        noise.start(t);

        voice = { noise, gain, filter };
        rollMap.set(key, voice);
      } else {
        voice.gain.gain.linearRampToValueAtTime(clamp(p.gain, 0, 1), t + 0.05);
        voice.filter.frequency.linearRampToValueAtTime(clampFreq(p.filterFreq), t + 0.05);
        voice.filter.Q.linearRampToValueAtTime(Math.max(0.1, p.q), t + 0.05);
      }
    },

    playMusic(pattern: MusicPattern) {
      stopAllMusic();
      const t0 = ctx.currentTime;
      const secPerBeat = 60 / pattern.bpm;

      for (const note of pattern.notes) {
        const startT = t0 + note.beat * secPerBeat;
        const durT = Math.max(0.04, note.duration * secPerBeat);
        const endT = startT + durT;
        const velGain = (note.velocity / 127) * 0.3;

        const gainNode = ctx.createGain();

        if (note.voice === 'perc' && note.midi === 42) {
          // Hi-hat noise burst
          const bs = ctx.createBufferSource();
          bs.buffer = getNoiseBuffer();
          bs.loop = true;
          const flt = ctx.createBiquadFilter();
          flt.type = 'highpass';
          flt.frequency.setValueAtTime(7000, startT);

          gainNode.gain.setValueAtTime(velGain, startT);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, endT);

          bs.connect(flt);
          flt.connect(gainNode);
          gainNode.connect(musicGain);

          bs.start(startT);
          bs.stop(endT + 0.02);
          musicNodes.push(bs);
        } else if (note.voice === 'perc' && note.midi === 36) {
          // Kick: low sine pitch drop
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(130, startT);
          osc.frequency.exponentialRampToValueAtTime(45, startT + Math.min(durT, 0.15));

          gainNode.gain.setValueAtTime(velGain * 1.5, startT);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, endT);

          osc.connect(gainNode);
          gainNode.connect(musicGain);

          osc.start(startT);
          osc.stop(endT + 0.02);
          musicNodes.push(osc);
        } else {
          // Tonal voices
          const osc = ctx.createOscillator();
          const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
          osc.frequency.setValueAtTime(clampFreq(freq), startT);

          if (note.voice === 'bass') {
            osc.type = 'triangle';
            gainNode.gain.setValueAtTime(velGain, startT);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, endT);
          } else if (note.voice === 'pad') {
            osc.type = 'triangle';
            // Slow attack
            gainNode.gain.setValueAtTime(0.0001, startT);
            gainNode.gain.linearRampToValueAtTime(velGain * 0.5, startT + Math.min(durT * 0.4, 0.6));
            gainNode.gain.exponentialRampToValueAtTime(0.0001, endT);
          } else {
            // lead
            osc.type = 'square';
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1800, startT);

            gainNode.gain.setValueAtTime(0.0001, startT);
            gainNode.gain.linearRampToValueAtTime(velGain * 0.4, startT + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, endT);

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(musicGain);

            osc.start(startT);
            osc.stop(endT + 0.02);
            musicNodes.push(osc);
            continue;
          }

          osc.connect(gainNode);
          gainNode.connect(musicGain);

          osc.start(startT);
          osc.stop(endT + 0.02);
          musicNodes.push(osc);
        }
      }
    },

    stopMusic() {
      stopAllMusic();
    },

    setVolumes(v: Partial<{ master: number; sfx: number; music: number }>) {
      const t = ctx.currentTime;
      if (v.master !== undefined) {
        vol.master = clamp(v.master, 0, 1);
        masterGain.gain.linearRampToValueAtTime(vol.master, t + 0.05);
      }
      if (v.sfx !== undefined) {
        vol.sfx = clamp(v.sfx, 0, 1);
        sfxGain.gain.linearRampToValueAtTime(vol.sfx, t + 0.05);
      }
      if (v.music !== undefined) {
        vol.music = clamp(v.music, 0, 1);
        musicGain.gain.linearRampToValueAtTime(vol.music, t + 0.05);
      }
    },

    get volumes() {
      return { ...vol };
    },

    dispose() {
      stopAllMusic();
      for (const [key] of engineMap) {
        this.stopEngine(key);
      }
      for (const [, voice] of rollMap) {
        try {
          voice.noise.stop();
          voice.noise.disconnect?.();
        } catch {
          // ignore
        }
      }
      rollMap.clear();
      for (const [, bed] of bedMap) for (const p of bed.parts) { try { p.stop(); } catch { /* ignore */ } }
      bedMap.clear();
      if (ctx.close) {
        ctx.close();
      }
    },
  };
}
