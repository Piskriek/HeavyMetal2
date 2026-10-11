// Shared mentor audio chain, preload, subtitle processing, and radio log (TASK-11).
// Connects the pure @hm/narrator state machine to Web Audio and the game HUD.
// Uses the owner's levels and curve from ./mentor-mix.ts.
import { MENTOR_MIX, driveCurve, radioBlend } from './mentor-mix';
import { kv } from '../storage/profile-storage';
import {
  createNarrator,
  fidelityRules,
  finish,
  step,
  trigger,
  say,
  type Rules,
  type State,
} from '@hm/narrator';

export interface VoiceClipInfo {
  readonly id: string;
  readonly when: string;
  readonly text: string;
  readonly cleanText: string;
  readonly duration: number;
}

export interface MentorVoiceSettings {
  dialogueVolume: number; // 0..1, default 0.8
  subtitlesEnabled: boolean; // default true
  voiceLevel: number; // 0..100, default 80
  radioLevel: number; // 0..100, default 10
  staticLevel: number; // 0..100, default 30
  overdrive: number; // 0..100, default 10
  isRadio: boolean; // default true
}

export const DEFAULT_SETTINGS: MentorVoiceSettings = {
  dialogueVolume: 0.8,
  subtitlesEnabled: true,
  voiceLevel: MENTOR_MIX.levels.voice,
  radioLevel: MENTOR_MIX.levels.radio,
  staticLevel: MENTOR_MIX.levels.static,
  overdrive: MENTOR_MIX.levels.overdrive,
  isRadio: true,
};

/** The radio log belongs to one save slot. With no slot there is no log: nothing is read or written. */
function logKeyForSlot(slot: string): string {
  return `fidelity.radio-log.${slot}`;
}

export function loadRadioLog(slot?: string): string[] {
  if (!slot) return [];
  try {
    const raw = kv.get(logKeyForSlot(slot));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveRadioLog(heard: readonly string[], slot?: string): void {
  if (!slot) return;
  kv.set(logKeyForSlot(slot), JSON.stringify(heard));
}

export function clearRadioLog(slot?: string): void {
  if (!slot) return;
  kv.remove(logKeyForSlot(slot));
}

const SETTINGS_KEY = 'fidelity.dialogue-settings';

export function loadDialogueSettings(): MentorVoiceSettings {
  try {
    const raw = kv.get(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MentorVoiceSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveDialogueSettings(s: Partial<MentorVoiceSettings>): void {
  const cur = loadDialogueSettings();
  kv.set(SETTINGS_KEY, JSON.stringify({ ...cur, ...s }));
}

/** Strip v3 audio cues like [breathes], [pause], [dry], [relieved], [quietly]. */
export function stripAudioTags(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Procedural pink/filtered noise buffer for the static bed under her voice. */
export function createNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const buffer = ctx.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
  }
  return buffer;
}

// Global cached buffers and metadata
const clipBuffers = new Map<string, AudioBuffer>();
const clipInfos = new Map<string, VoiceClipInfo>();
let staticBedBuffer: AudioBuffer | null = null;
let cachedRules: Rules | null = null;

/** Preloads all voiced clips from /vo/index.json behind the loading screen. */
export async function preloadMentorVo(
  audioCtx?: AudioContext,
): Promise<{
  rules: Rules;
  clips: Map<string, AudioBuffer>;
  info: Map<string, VoiceClipInfo>;
}> {
  if (cachedRules && clipBuffers.size >= 37) {
    return { rules: cachedRules, clips: clipBuffers, info: clipInfos };
  }

  const c = audioCtx ?? (typeof AudioContext !== 'undefined' ? new AudioContext() : null);

  // Fetch index.json
  let index: { id: string; when: string; text: string }[] = [];
  try {
    const res = await fetch('/vo/index.json');
    if (res.ok) {
      index = (await res.json()) as { id: string; when: string; text: string }[];
    }
  } catch (err) {
    console.warn('[mentor-voice] Failed to fetch /vo/index.json:', err);
  }

  // Pre-fetch and decode all .mp3 clips
  const secondsById: Record<string, number> = {};

  await Promise.all(
    index.map(async (item) => {
      const clean = stripAudioTags(item.text);
      let duration = 3.0; // fallback duration

      if (c) {
        try {
          let buf = clipBuffers.get(item.id);
          if (!buf) {
            const r = await fetch(`/vo/${item.id}.mp3`);
            if (r.ok) {
              const arrayBuf = await r.arrayBuffer();
              buf = await c.decodeAudioData(arrayBuf);
              clipBuffers.set(item.id, buf);
            }
          }
          if (buf) {
            duration = buf.duration;
          }
        } catch (e) {
          console.warn(`[mentor-voice] Failed decoding /vo/${item.id}.mp3:`, e);
        }
      }

      secondsById[item.id] = duration;
      clipInfos.set(item.id, {
        id: item.id,
        when: item.when,
        text: item.text,
        cleanText: clean,
        duration,
      });
    }),
  );

  // Preload static bed
  if (c && !staticBedBuffer) {
    try {
      const r = await fetch('/src/dev/tmp/bed-static.mp3');
      if (r.ok) {
        staticBedBuffer = await c.decodeAudioData(await r.arrayBuffer());
      }
    } catch {
      // Fallback to procedural noise
      staticBedBuffer = createNoiseBuffer(c, 4);
    }
  }

  cachedRules = fidelityRules(secondsById);
  return { rules: cachedRules, clips: clipBuffers, info: clipInfos };
}

export function getVoiceClipInfo(id: string): VoiceClipInfo | undefined {
  return clipInfos.get(id);
}

export function getAllVoiceClips(): VoiceClipInfo[] {
  return Array.from(clipInfos.values());
}

/**
 * Builds the shared Web Audio chain:
 * Voice -> [HighPass -> LowPass -> MidPresence -> DeHarsh -> OverdriveWaveShaper -> Compressor -> WetGain]
 *       +  [DryGain] -> voGain -> destination
 * Static Bed -> LowPass(5kHz) -> stGain -> destination
 */
export function createMentorVoiceChain(
  ctx: AudioContext,
  destination: AudioNode = ctx.destination,
  initialSettings: MentorVoiceSettings = loadDialogueSettings(),
) {
  const M = MENTOR_MIX;
  let settings = { ...initialSettings };

  // Voice filter chain
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = M.band.highpassHz;
  hp.Q.value = M.band.highpassQ;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = M.band.lowpassHz;
  lp.Q.value = M.band.lowpassQ;

  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = M.presence.hz;
  mid.Q.value = M.presence.q;
  mid.gain.value = M.presence.gainDb;

  const deHarsh = ctx.createBiquadFilter();
  deHarsh.type = 'peaking';
  deHarsh.frequency.value = M.deHarsh.hz;
  deHarsh.Q.value = M.deHarsh.q;
  deHarsh.gain.value = M.deHarsh.gainDb;

  const sh = ctx.createWaveShaper();
  sh.curve = driveCurve(settings.overdrive / 100) as unknown as Float32Array<ArrayBuffer>;
  sh.oversample = '4x';

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = M.compressor.thresholdDb;
  comp.ratio.value = M.compressor.ratio;
  comp.attack.value = M.compressor.attackS;
  comp.release.value = M.compressor.releaseS;

  const blend = radioBlend(settings.isRadio ? settings.radioLevel / 100 : 0);
  const wet = ctx.createGain();
  wet.gain.value = blend.wet;

  const dry = ctx.createGain();
  dry.gain.value = blend.dry;

  const voGain = ctx.createGain();
  voGain.gain.value = (settings.voiceLevel / 100) * M.scale.voice * settings.dialogueVolume;

  hp.connect(lp).connect(mid).connect(deHarsh).connect(sh).connect(comp).connect(wet).connect(voGain);
  dry.connect(voGain);
  voGain.connect(destination);

  // Static bed path
  const stLp = ctx.createBiquadFilter();
  stLp.type = 'lowpass';
  stLp.frequency.value = M.staticLowpassHz;

  const stGain = ctx.createGain();
  stGain.gain.value = (settings.staticLevel / 100) * M.scale.static * settings.dialogueVolume;

  stLp.connect(stGain).connect(destination);

  let curVoSrc: AudioBufferSourceNode | null = null;
  let curStSrc: AudioBufferSourceNode | null = null;
  let isPlaying = false;
  let activeId: string | null = null;

  function updateSettings(next: Partial<MentorVoiceSettings>): void {
    settings = { ...settings, ...next };
    const b = radioBlend(settings.isRadio ? settings.radioLevel / 100 : 0);
    wet.gain.setTargetAtTime(b.wet, ctx.currentTime, 0.05);
    dry.gain.setTargetAtTime(b.dry, ctx.currentTime, 0.05);
    sh.curve = driveCurve(settings.overdrive / 100) as unknown as Float32Array<ArrayBuffer>;
    const vG = (settings.voiceLevel / 100) * M.scale.voice * settings.dialogueVolume;
    voGain.gain.setTargetAtTime(vG, ctx.currentTime, 0.05);
    const sG = (settings.staticLevel / 100) * M.scale.static * settings.dialogueVolume;
    stGain.gain.setTargetAtTime(sG, ctx.currentTime, 0.05);
  }

  function stop(fadeSeconds = 0.3): void {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    voGain.gain.cancelScheduledValues(now);
    stGain.gain.cancelScheduledValues(now);
    voGain.gain.setValueAtTime(voGain.gain.value, now);
    voGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    stGain.gain.setValueAtTime(stGain.gain.value, now);
    stGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);

    const oldVo = curVoSrc;
    const oldSt = curStSrc;
    setTimeout(() => {
      try { oldVo?.stop(); } catch { /* ignore */ }
      try { oldSt?.stop(); } catch { /* ignore */ }
    }, (fadeSeconds + 0.05) * 1000);

    curVoSrc = null;
    curStSrc = null;
    isPlaying = false;
    activeId = null;
  }

  function play(
    id: string,
    options?: {
      onEnd?: () => void;
      duckMusic?: (ducked: boolean) => void;
    },
  ): { duration: number; stop: (fade?: number) => void } {
    stop(0.08); // brief crossfade if already running

    const voBuf = clipBuffers.get(id);
    if (!voBuf) {
      options?.onEnd?.();
      return { duration: 0, stop: () => {} };
    }

    const t0 = ctx.currentTime + 0.05;
    const lead = 0.1; // small lead for static before voice

    // Voice source
    const voSrc = ctx.createBufferSource();
    voSrc.buffer = voBuf;
    voSrc.connect(hp);
    voSrc.connect(dry);

    // Static source
    const stBuf = staticBedBuffer ?? createNoiseBuffer(ctx, 4);
    const stSrc = ctx.createBufferSource();
    stSrc.buffer = stBuf;
    stSrc.loop = true;
    stSrc.connect(stLp);

    // Reset fader gains
    const vG = (settings.voiceLevel / 100) * M.scale.voice * settings.dialogueVolume;
    const sG = (settings.staticLevel / 100) * M.scale.static * settings.dialogueVolume;
    voGain.gain.setValueAtTime(vG, t0);
    stGain.gain.setValueAtTime(sG, t0);

    stSrc.start(t0);
    voSrc.start(t0 + lead);

    isPlaying = true;
    activeId = id;
    curVoSrc = voSrc;
    curStSrc = stSrc;

    // Ducking
    options?.duckMusic?.(true);

    const endTimer = setTimeout(() => {
      if (curVoSrc === voSrc) {
        stop(0.2);
        options?.duckMusic?.(false);
        options?.onEnd?.();
      }
    }, (lead + voBuf.duration) * 1000);

    voSrc.onended = () => {
      if (curVoSrc === voSrc) {
        clearTimeout(endTimer);
        stop(0.2);
        options?.duckMusic?.(false);
        options?.onEnd?.();
      }
    };

    return {
      duration: voBuf.duration,
      stop: (f = 0.3) => {
        clearTimeout(endTimer);
        options?.duckMusic?.(false);
        stop(f);
      },
    };
  }

  return {
    play,
    stop,
    updateSettings,
    getSettings: () => ({ ...settings }),
    isPlaying: () => isPlaying,
    getActiveId: () => activeId,
  };
}

export type MentorVoiceChain = ReturnType<typeof createMentorVoiceChain>;

/**
 * High-level narration controller that ties @hm/narrator to the audio chain,
 * subtitle emission, and persistent radio log.
 */
export class GameNarratorController {
  private rules: Rules;
  private state: State;
  private chain: MentorVoiceChain | null = null;
  private ctx: AudioContext | null = null;
  private settings: MentorVoiceSettings;
  private slot?: string;
  private activeSub: { id: string; text: string; cleanText: string } | null = null;
  private subSubscribers = new Set<(sub: { id: string; text: string; cleanText: string } | null) => void>();
  private logSubscribers = new Set<(heard: readonly string[]) => void>();
  private duckCallback: ((ducked: boolean) => void) | null = null;

  constructor(rules: Rules, initialHeard?: string[], settings = loadDialogueSettings(), slot?: string) {
    this.slot = slot;
    this.rules = rules;
    this.state = createNarrator(initialHeard ?? loadRadioLog(slot));
    this.settings = settings;
  }

  public setSlot(slot?: string): void {
    this.slot = slot;
  }

  public resetLog(): void {
    clearRadioLog(this.slot);
    this.state = createNarrator([]);
    this.activeSub = null;
    this.notifySubscribers();
    this.logSubscribers.forEach((cb) => cb(this.state.heard));
  }

  public setRules(rules: Rules): void {
    this.rules = rules;
  }

  public initAudio(ctx: AudioContext, destination?: AudioNode): void {
    this.ctx = ctx;
    this.chain = createMentorVoiceChain(ctx, destination, this.settings);
  }

  public onSubtitle(cb: (sub: { id: string; text: string; cleanText: string } | null) => void): () => void {
    this.subSubscribers.add(cb);
    cb(this.activeSub);
    return () => this.subSubscribers.delete(cb);
  }

  public onRadioLog(cb: (heard: readonly string[]) => void): () => void {
    this.logSubscribers.add(cb);
    cb(this.state.heard);
    return () => this.logSubscribers.delete(cb);
  }

  public setDuckCallback(cb: (ducked: boolean) => void): void {
    this.duckCallback = cb;
  }

  public getSettings(): MentorVoiceSettings {
    return { ...this.settings };
  }

  public setDialogueVolume(vol: number): void {
    this.settings.dialogueVolume = Math.max(0, Math.min(1, vol));
    saveDialogueSettings({ dialogueVolume: this.settings.dialogueVolume });
    this.chain?.updateSettings({ dialogueVolume: this.settings.dialogueVolume });
  }

  public setSubtitlesEnabled(enabled: boolean): void {
    this.settings.subtitlesEnabled = enabled;
    saveDialogueSettings({ subtitlesEnabled: enabled });
    this.notifySubscribers();
  }

  public getState(): State {
    return this.state;
  }

  public getActiveSubtitle(): { id: string; text: string; cleanText: string } | null {
    if (!this.settings.subtitlesEnabled) return null;
    return this.activeSub;
  }

  public trigger(event: string): void {
    this.state = trigger(this.rules, this.state, event);
  }

  public say(id: string): void {
    this.state = say(this.rules, this.state, id);
  }

  public replay(id: string): void {
    const info = getVoiceClipInfo(id);
    if (!info) return;

    if (this.ctx && this.chain) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.chain.play(id, {
        duckMusic: (d) => this.duckCallback?.(d),
      });
    }

    // Show subtitle during replay too
    this.activeSub = { id, text: info.text, cleanText: info.cleanText };
    this.notifySubscribers();
    setTimeout(() => {
      if (this.activeSub?.id === id) {
        this.activeSub = null;
        this.notifySubscribers();
      }
    }, (info.duration + 0.4) * 1000);
  }

  public step(dt: number): void {
    const prevHeardLen = this.state.heard.length;
    const res = step(this.rules, this.state, dt);
    this.state = res.state;

    // Check if heard log grew
    if (this.state.heard.length > prevHeardLen) {
      saveRadioLog(this.state.heard, this.slot);
      this.logSubscribers.forEach((cb) => cb(this.state.heard));
    }

    // Cut line if requested (e.g. bark preempted)
    if (res.cut) {
      this.chain?.stop(0.3);
      if (this.activeSub?.id === res.cut) {
        this.activeSub = null;
        this.notifySubscribers();
      }
    }

    // Start line if requested
    if (res.start) {
      const lineId = res.start;
      const info = getVoiceClipInfo(lineId);
      const text = info?.text ?? '';
      const clean = info?.cleanText ?? stripAudioTags(text);

      this.activeSub = { id: lineId, text, cleanText: clean };
      this.notifySubscribers();

      if (this.ctx && this.chain) {
        if (this.ctx.state === 'suspended') {
          void this.ctx.resume();
        }
        this.chain.play(lineId, {
          onEnd: () => {
            this.state = finish(this.rules, this.state, lineId);
            if (this.activeSub?.id === lineId) {
              this.activeSub = null;
              this.notifySubscribers();
            }
          },
          duckMusic: (d) => this.duckCallback?.(d),
        });
      }
    }

    // Check if playing naturally ended in narrator state
    if (!this.state.playing && this.activeSub) {
      this.activeSub = null;
      this.notifySubscribers();
    }
  }

  private notifySubscribers(): void {
    const sub = this.settings.subtitlesEnabled ? this.activeSub : null;
    this.subSubscribers.forEach((cb) => cb(sub));
  }
}
