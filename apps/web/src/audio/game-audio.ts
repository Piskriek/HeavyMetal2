// Comprehensive game audio engine for FIDELITY / SetMix (TASK-12).
// Architecture:
// MasterBus -> MusicBus (with MentorDuckGain), SfxBus, DialogueBus.
// - Loading strategy: Decode 36 SFX and lab music at startup; decode 7 Moon tracks,
//   Monster Mash, and driving music behind gate transition / before first Moon visit.
// - Equal-power Moon score stage crossfading (tracks music-moon-s0..s6).
// - Context music: lab, moon, monster mash (mobs engage), driving (in rover).
// - Positional SFX engine: max 8 positional voices using PannerNode (equalpower), voice stealing for farthest.
// - Zero allocations in audio update loop.
// - window.__audio debug inspection hook.

import { MENTOR_MIX } from './mentor-mix';
import { kv } from '../storage/profile-storage';

export interface AudioLevel {
  readonly gain: number; // dB
  readonly rms?: number;
  readonly start?: number; // loop start (s)
  readonly end?: number; // loop end (s)
}

export interface AudioEntry {
  readonly id: string;
  readonly kind: 'music' | 'sfx';
  readonly duration: number;
  readonly text: string;
  readonly loop: boolean;
}

export interface AudioSettings {
  master: number; // 0..1, default 1.0
  music: number; // 0..1, default 0.8
  effects: number; // 0..1, default 0.8
  dialogue: number; // 0..1, default 0.8
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1.0,
  music: 0.8,
  effects: 0.8,
  dialogue: 0.8,
};

const SETTINGS_KEY = 'fidelity.audio-settings';

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = kv.get(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return { ...DEFAULT_AUDIO_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(s: Partial<AudioSettings>): void {
  const cur = loadAudioSettings();
  kv.set(SETTINGS_KEY, JSON.stringify({ ...cur, ...s }));
}

export type MusicContext = 'silent' | 'lab' | 'moon' | 'monster-mash' | 'driving';

export interface PositionalVoice {
  id: string;
  key?: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode: PannerNode;
  x: number;
  y: number;
  z: number;
  loop: boolean;
  priority: number;
  startTime: number;
  baseVolume: number;
  stopped: boolean;
}

export interface Play2dOptions {
  volume?: number;
  pitch?: number;
  loop?: boolean;
}

export interface Play3dOptions {
  key?: string;
  volume?: number;
  pitch?: number;
  loop?: boolean;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  priority?: number;
}

export class GameAudioController {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;

  // Master & Bus Nodes
  private masterGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private dialogueBus: GainNode | null = null;

  // Music Context Sub-buses
  private labMusicGain: GainNode | null = null;
  private moonGroupGain: GainNode | null = null;
  private mashMusicGain: GainNode | null = null;
  private drivingMusicGain: GainNode | null = null;

  // Moon Score Stage Tracks (0..6)
  private moonTrackGains: GainNode[] = [];
  private moonSources: AudioBufferSourceNode[] = [];
  private moonScorePlaying = false;
  private moonWeights: number[] = [1, 0, 0, 0, 0, 0, 0];
  private currentStage = 0;

  // Other Running Music Sources
  private labMusicSource: AudioBufferSourceNode | null = null;
  private mashMusicSource: AudioBufferSourceNode | null = null;
  private drivingMusicSource: AudioBufferSourceNode | null = null;

  // Music State
  private currentContext: MusicContext = 'silent';
  private calmTimer = 0;
  private mobsEngaged = false;
  private isDriving = false;

  // Audio Assets & Metadata Cache
  private levels: Record<string, AudioLevel> = {};
  private entries: AudioEntry[] = [];
  private bufferCache = new Map<string, AudioBuffer>();
  private bufferPromises = new Map<string, Promise<AudioBuffer | null>>();

  // Positional Voices (max 8)
  private activePositionalVoices: PositionalVoice[] = [];
  private keyedLoops = new Map<string, PositionalVoice>();

  // Diagnostic & Profiling
  private lastCpuTimeMs = 0;
  private avgCpuTimeMs = 0;
  private recentSoundLog: string[] = [];
  private readonly MAX_RECENT_LOG = 32;

  // Scratch values for zero per-frame allocation
  private listenerX = 0;
  private listenerY = 0;
  private listenerZ = 0;

  constructor(initialSettings = loadAudioSettings()) {
    this.settings = initialSettings;
  }

  // ---------------------------------------------------------------------------
  // AudioContext & Graph Initialization
  // ---------------------------------------------------------------------------

  public getContext(): AudioContext {
    if (!this.ctx) {
      if (typeof window !== 'undefined' && (window as any).__hmAudioContext) {
        this.ctx = (window as any).__hmAudioContext as AudioContext;
      } else if (typeof AudioContext !== 'undefined') {
        this.ctx = new AudioContext();
        if (typeof window !== 'undefined') {
          (window as any).__hmAudioContext = this.ctx;
        }
      } else {
        throw new Error('AudioContext not supported in this environment');
      }
      this.buildGraph();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private buildGraph(): void {
    if (!this.ctx) return;
    const c = this.ctx;

    // Master
    this.masterGain = c.createGain();
    this.masterGain.gain.value = this.settings.master;
    this.masterGain.connect(c.destination);

    // Dialogue Bus (plugs directly into Master)
    this.dialogueBus = c.createGain();
    this.dialogueBus.gain.value = this.settings.dialogue;
    this.dialogueBus.connect(this.masterGain);

    // SFX Bus (plugs directly into Master)
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = this.settings.effects;
    this.sfxBus.connect(this.masterGain);

    // Music Ducking Node (ducks under Dr. Haddy's lines)
    this.musicDuckGain = c.createGain();
    this.musicDuckGain.gain.value = 1.0;
    this.musicDuckGain.connect(this.masterGain);

    // Music Bus (connects to MusicDuckGain)
    this.musicBus = c.createGain();
    this.musicBus.gain.value = this.settings.music;
    this.musicBus.connect(this.musicDuckGain);

    // Context Sub-buses
    this.labMusicGain = c.createGain();
    this.labMusicGain.gain.value = 0.0;
    this.labMusicGain.connect(this.musicBus);

    this.moonGroupGain = c.createGain();
    this.moonGroupGain.gain.value = 0.0;
    this.moonGroupGain.connect(this.musicBus);

    this.mashMusicGain = c.createGain();
    this.mashMusicGain.gain.value = 0.0;
    this.mashMusicGain.connect(this.musicBus);

    this.drivingMusicGain = c.createGain();
    this.drivingMusicGain.gain.value = 0.0;
    this.drivingMusicGain.connect(this.musicBus);

    // Moon Score 7 Track Gains (stage 0..6)
    this.moonTrackGains = [];
    for (let i = 0; i < 7; i++) {
      const tg = c.createGain();
      tg.gain.value = 0.0;
      tg.connect(this.moonGroupGain);
      this.moonTrackGains.push(tg);
    }

    this.setupDebugHook();
  }

  public getDialogueBus(): AudioNode {
    this.getContext();
    return this.dialogueBus!;
  }

  public getSfxBus(): AudioNode {
    this.getContext();
    return this.sfxBus!;
  }

  public getMusicBus(): AudioNode {
    this.getContext();
    return this.musicBus!;
  }

  // ---------------------------------------------------------------------------
  // Settings & Bus Volumes
  // ---------------------------------------------------------------------------

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public setMasterVolume(vol: number): void {
    this.settings.master = Math.max(0, Math.min(1, vol));
    saveAudioSettings({ master: this.settings.master });
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.settings.master, this.ctx.currentTime, 0.05);
    }
  }

  public setMusicVolume(vol: number): void {
    this.settings.music = Math.max(0, Math.min(1, vol));
    saveAudioSettings({ music: this.settings.music });
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(this.settings.music, this.ctx.currentTime, 0.05);
    }
  }

  public setEffectsVolume(vol: number): void {
    this.settings.effects = Math.max(0, Math.min(1, vol));
    saveAudioSettings({ effects: this.settings.effects });
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.settings.effects, this.ctx.currentTime, 0.05);
    }
  }

  public setDialogueVolume(vol: number): void {
    this.settings.dialogue = Math.max(0, Math.min(1, vol));
    saveAudioSettings({ dialogue: this.settings.dialogue });
    if (this.dialogueBus && this.ctx) {
      this.dialogueBus.gain.setTargetAtTime(this.settings.dialogue, this.ctx.currentTime, 0.05);
    }
  }

  public duckMusic(ducked: boolean): void {
    if (!this.musicDuckGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = ducked ? (MENTOR_MIX.duck.to ?? 0.3) : 1.0;
    const timeConstant = ducked ? 0.08 : 0.2;
    this.musicDuckGain.gain.setTargetAtTime(target, now, timeConstant);
  }

  // ---------------------------------------------------------------------------
  // Asset Loading & Metadata
  // ---------------------------------------------------------------------------

  public async fetchMetadata(): Promise<void> {
    if (Object.keys(this.levels).length > 0 && this.entries.length > 0) return;
    try {
      const [levelsRes, indexRes] = await Promise.all([
        fetch('/audio/levels.json'),
        fetch('/audio/index.json'),
      ]);
      if (levelsRes.ok) {
        const data = (await levelsRes.json()) as { levels: Record<string, AudioLevel> };
        this.levels = data.levels || {};
      }
      if (indexRes.ok) {
        this.entries = (await indexRes.json()) as AudioEntry[];
      }
    } catch (err) {
      console.warn('[game-audio] Failed fetching audio metadata:', err);
    }
  }

  public gainOf(id: string): number {
    const lvl = this.levels[id];
    const db = lvl?.gain ?? 0;
    return 10 ** (db / 20);
  }

  public applyLoopRegion(src: AudioBufferSourceNode, id: string): void {
    const lvl = this.levels[id];
    if (lvl?.start !== undefined && lvl?.end !== undefined) {
      src.loopStart = lvl.start;
      src.loopEnd = lvl.end;
    }
  }

  public async loadBuffer(id: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(id);
    if (cached) return cached;

    const existingPromise = this.bufferPromises.get(id);
    if (existingPromise) return existingPromise;

    const promise = (async () => {
      try {
        const c = this.getContext();
        const res = await fetch(`/audio/${id}.mp3`);
        if (!res.ok) {
          console.warn(`[game-audio] Failed to fetch /audio/${id}.mp3: ${res.status}`);
          return null;
        }
        const ab = await res.arrayBuffer();
        const buf = await c.decodeAudioData(ab);
        this.bufferCache.set(id, buf);
        return buf;
      } catch (e) {
        console.warn(`[game-audio] Failed decoding /audio/${id}.mp3:`, e);
        return null;
      }
    })();

    this.bufferPromises.set(id, promise);
    return promise;
  }

  public getBuffer(id: string): AudioBuffer | null {
    return this.bufferCache.get(id) ?? null;
  }

  /**
   * Preload strategy 1: Decode all 36 sound effects and lab music at startup
   * behind the initial game loading screen.
   */
  public async preloadStartupAudio(): Promise<void> {
    await this.fetchMetadata();
    const sfxEntries = this.entries.filter((e) => e.kind === 'sfx');
    const toLoad = [...sfxEntries.map((e) => e.id), 'music-lab'];
    await Promise.all(toLoad.map((id) => this.loadBuffer(id)));
  }

  /**
   * Preload strategy 2: Decode the seven music-moon-s0..s6 tracks, Monster Mash,
   * and driving music before first Moon visit or behind gate transition.
   */
  public async preloadMoonAudio(): Promise<void> {
    await this.fetchMetadata();
    const toLoad = [
      'music-moon-s0',
      'music-moon-s1',
      'music-moon-s2',
      'music-moon-s3',
      'music-moon-s4',
      'music-moon-s5',
      'music-moon-s6',
      'music-monster-mash',
      'music-driving',
    ];
    await Promise.all(toLoad.map((id) => this.loadBuffer(id)));
  }

  // ---------------------------------------------------------------------------
  // Music Controller & Context Transitions
  // ---------------------------------------------------------------------------

  public getMusicContext(): MusicContext {
    return this.currentContext;
  }

  public getMoonWeights(): readonly number[] {
    return this.moonWeights;
  }

  /**
   * Silence everything the game started: every music source, every looping and positional effect, the duck.
   * Called when the game screen closes. The controller is a singleton that outlives the screen, so without this
   * the music played on in the menu (the owner's report, 2026-10-12). The buffers stay cached for the next visit.
   */
  public stopAll(): void {
    const stop = (s: AudioBufferSourceNode | null): void => { if (!s) return; try { s.stop(); } catch { /* already stopped */ } s.disconnect(); };
    stop(this.labMusicSource); this.labMusicSource = null;
    stop(this.mashMusicSource); this.mashMusicSource = null;
    stop(this.drivingMusicSource); this.drivingMusicSource = null;
    for (const s of this.moonSources) stop(s);
    this.moonSources = [];
    this.moonScorePlaying = false;
    for (const v of this.activePositionalVoices) stop(v.source);
    this.activePositionalVoices = [];
    for (const v of this.keyedLoops.values()) stop(v.source);
    this.keyedLoops.clear();
    this.currentContext = 'silent';
    this.mobsEngaged = false;
    this.isDriving = false;
    this.calmTimer = 0;
    if (this.ctx && this.musicDuckGain) this.musicDuckGain.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  public setMusicContext(context: MusicContext, crossfadeSeconds = 1.5): void {
    if (this.currentContext === context) return;
    this.currentContext = context;
    this.applyMusicContextCrossfade(crossfadeSeconds);
  }

  private applyMusicContextCrossfade(fadeSeconds: number): void {
    if (!this.ctx || !this.labMusicGain || !this.moonGroupGain || !this.mashMusicGain || !this.drivingMusicGain) return;
    const now = this.ctx.currentTime;
    const tc = Math.max(0.08, fadeSeconds / 3);

    // Target gains based on context
    const labTarget = this.currentContext === 'lab' ? 1.0 : 0.0;
    const moonTarget = this.currentContext === 'moon' ? 1.0 : 0.0;
    const mashTarget = this.currentContext === 'monster-mash' ? 1.0 : 0.0;
    const drivingTarget = this.currentContext === 'driving' ? 1.0 : 0.0;

    this.labMusicGain.gain.setTargetAtTime(labTarget, now, tc);
    this.moonGroupGain.gain.setTargetAtTime(moonTarget, now, tc);
    this.mashMusicGain.gain.setTargetAtTime(mashTarget, now, tc);
    this.drivingMusicGain.gain.setTargetAtTime(drivingTarget, now, tc);

    // Start background playback if not yet running
    if (this.currentContext === 'lab') {
      this.ensureLabMusicRunning();
    } else if (this.currentContext === 'moon') {
      this.ensureMoonScoreRunning();
    } else if (this.currentContext === 'monster-mash') {
      this.ensureMashMusicRunning();
    } else if (this.currentContext === 'driving') {
      this.ensureDrivingMusicRunning();
    }
  }

  private ensureLabMusicRunning(): void {
    if (this.labMusicSource) return;
    const buf = this.getBuffer('music-lab');
    if (!buf || !this.ctx || !this.labMusicGain) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.applyLoopRegion(src, 'music-lab');
      const levelGain = this.ctx.createGain();
      levelGain.gain.value = this.gainOf('music-lab');
      src.connect(levelGain).connect(this.labMusicGain);
      src.start();
      this.labMusicSource = src;
    } catch (e) {
      console.warn('[game-audio] Failed starting lab music:', e);
    }
  }

  public ensureMoonScoreRunning(): void {
    if (this.moonScorePlaying) return;
    if (!this.ctx || this.moonTrackGains.length < 7) return;

    // Verify all 7 tracks are loaded
    for (let i = 0; i < 7; i++) {
      if (!this.getBuffer(`music-moon-s${i}`)) {
        // Asynchronously load if not present and retry
        void this.preloadMoonAudio().then(() => this.ensureMoonScoreRunning());
        return;
      }
    }

    const t0 = this.ctx.currentTime + 0.08;
    this.moonSources = [];

    for (let i = 0; i < 7; i++) {
      const id = `music-moon-s${i}`;
      const buf = this.getBuffer(id)!;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.applyLoopRegion(src, id);

      const levelGain = this.ctx.createGain();
      levelGain.gain.value = this.gainOf(id);

      src.connect(levelGain).connect(this.moonTrackGains[i]!);
      src.start(t0);
      this.moonSources.push(src);
    }

    this.moonScorePlaying = true;
    this.applyMoonScoreStageWeights(this.currentStage);
  }

  private ensureMashMusicRunning(): void {
    if (this.mashMusicSource) return;
    const buf = this.getBuffer('music-monster-mash');
    if (!buf || !this.ctx || !this.mashMusicGain) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.applyLoopRegion(src, 'music-monster-mash');
      const levelGain = this.ctx.createGain();
      levelGain.gain.value = this.gainOf('music-monster-mash');
      src.connect(levelGain).connect(this.mashMusicGain);
      src.start();
      this.mashMusicSource = src;
    } catch (e) {
      console.warn('[game-audio] Failed starting mash music:', e);
    }
  }

  private ensureDrivingMusicRunning(): void {
    if (this.drivingMusicSource) return;
    const buf = this.getBuffer('music-driving');
    if (!buf || !this.ctx || !this.drivingMusicGain) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.applyLoopRegion(src, 'music-driving');
      const levelGain = this.ctx.createGain();
      levelGain.gain.value = this.gainOf('music-driving');
      src.connect(levelGain).connect(this.drivingMusicGain);
      src.start();
      this.drivingMusicSource = src;
    } catch (e) {
      console.warn('[game-audio] Failed starting driving music:', e);
    }
  }

  /**
   * Updates stage for equal-power crossfading across the seven Moon tracks:
   * d = |v - i|; weight = d >= 1 ? 0 : cos(d * pi / 2);
   */
  public setMoonStage(stage: number): void {
    this.currentStage = Math.max(0, Math.min(6, stage));
    this.applyMoonScoreStageWeights(this.currentStage);
  }

  private applyMoonScoreStageWeights(stage: number): void {
    const weights: number[] = [];
    const now = this.ctx ? this.ctx.currentTime : 0;

    for (let i = 0; i < 7; i++) {
      const d = Math.abs(stage - i);
      const w = d >= 1 ? 0 : Math.cos((d * Math.PI) / 2);
      weights.push(w);

      if (this.moonTrackGains[i] && this.ctx) {
        this.moonTrackGains[i]!.gain.setTargetAtTime(w, now, 0.12);
      }
    }

    this.moonWeights = weights;
  }

  public setMobsEngaged(engaged: boolean): void {
    if (this.mobsEngaged === engaged) return;
    this.mobsEngaged = engaged;
    if (engaged) {
      this.calmTimer = 0;
      if (!this.isDriving && this.currentContext !== 'lab') {
        this.setMusicContext('monster-mash', 2.0);
      }
    }
  }

  public setDriving(driving: boolean): void {
    if (this.isDriving === driving) return;
    this.isDriving = driving;
    if (driving) {
      this.setMusicContext('driving', 1.5);
    } else {
      if (this.mobsEngaged) {
        this.setMusicContext('monster-mash', 2.0);
      } else {
        this.setMusicContext('moon', 1.5);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Sound Effects Engine (Max 8 Positional Voices)
  // ---------------------------------------------------------------------------

  /**
   * Play a 2D interface or non-spatialized sound directly into SfxBus.
   * Does not consume a 3D voice slot.
   */
  public play2d(id: string, options?: Play2dOptions): AudioBufferSourceNode | null {
    const buf = this.getBuffer(id);
    if (!buf) {
      void this.loadBuffer(id).then((b) => {
        if (b) this.play2d(id, options);
      });
      return null;
    }
    const c = this.getContext();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = options?.loop ?? false;
    if (options?.loop) this.applyLoopRegion(src, id);
    if (options?.pitch) src.playbackRate.value = options.pitch;

    const gain = c.createGain();
    const baseGain = this.gainOf(id);
    const vol = options?.volume ?? 1.0;
    gain.gain.value = baseGain * vol;

    src.connect(gain).connect(this.sfxBus!);
    src.start();

    this.recordRecentSound(id);
    return src;
  }

  /**
   * Play a 3D spatialized sound using PannerNode (equalpower, inverse distance).
   * Voice budget: Max 8 positional voices. The farthest voice is stolen if budget exceeded.
   */
  public play3d(
    id: string,
    pos: { x: number; y: number; z: number },
    options?: Play3dOptions,
  ): PositionalVoice | null {
    const buf = this.getBuffer(id);
    if (!buf) {
      void this.loadBuffer(id).then((b) => {
        if (b) this.play3d(id, pos, options);
      });
      return null;
    }

    const c = this.getContext();

    // Check voice limit (max 8)
    if (this.activePositionalVoices.length >= 8) {
      this.stealFarthestVoice();
    }

    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = options?.loop ?? false;
    if (options?.loop) this.applyLoopRegion(src, id);
    if (options?.pitch) src.playbackRate.value = options.pitch;

    const gain = c.createGain();
    const baseGain = this.gainOf(id);
    const vol = options?.volume ?? 1.0;
    gain.gain.value = baseGain * vol;

    const panner = c.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = options?.refDistance ?? 1.5;
    panner.maxDistance = options?.maxDistance ?? 80.0;
    panner.rolloffFactor = options?.rolloffFactor ?? 1.0;

    this.setPannerPosition(panner, pos.x, pos.y, pos.z);

    src.connect(gain).connect(panner).connect(this.sfxBus!);
    src.start();

    const voice: PositionalVoice = {
      id,
      key: options?.key,
      source: src,
      gainNode: gain,
      pannerNode: panner,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      loop: options?.loop ?? false,
      priority: options?.priority ?? 1,
      startTime: c.currentTime,
      baseVolume: vol,
      stopped: false,
    };

    if (!voice.loop) {
      src.onended = () => {
        voice.stopped = true;
        this.removePositionalVoice(voice);
      };
    }

    this.activePositionalVoices.push(voice);
    if (options?.key) {
      this.keyedLoops.set(options.key, voice);
    }

    this.recordRecentSound(id);
    return voice;
  }

  private setPannerPosition(panner: PannerNode, x: number, y: number, z: number): void {
    if (this.ctx && 'positionX' in panner) {
      panner.positionX.setValueAtTime(x, this.ctx.currentTime);
      panner.positionY.setValueAtTime(y, this.ctx.currentTime);
      panner.positionZ.setValueAtTime(z, this.ctx.currentTime);
    } else {
      (panner as any).setPosition(x, y, z);
    }
  }

  private stealFarthestVoice(): void {
    if (this.activePositionalVoices.length === 0) return;
    let maxDistSq = -1;
    let worstIndex = 0;

    for (let i = 0; i < this.activePositionalVoices.length; i++) {
      const v = this.activePositionalVoices[i]!;
      const dx = v.x - this.listenerX;
      const dy = v.y - this.listenerY;
      const dz = v.z - this.listenerZ;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        worstIndex = i;
      }
    }

    const victim = this.activePositionalVoices[worstIndex]!;
    this.stopVoice(victim);
    this.activePositionalVoices.splice(worstIndex, 1);
  }

  private stopVoice(voice: PositionalVoice, fadeSeconds = 0.04): void {
    if (voice.stopped) return;
    voice.stopped = true;
    if (voice.key) this.keyedLoops.delete(voice.key);
    try {
      if (this.ctx && fadeSeconds > 0) {
        voice.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, fadeSeconds / 2);
        setTimeout(() => {
          try {
            voice.source.stop();
            voice.source.disconnect();
            voice.pannerNode.disconnect();
          } catch {
            /* ignore */
          }
        }, fadeSeconds * 1000 + 20);
      } else {
        voice.source.stop();
        voice.source.disconnect();
        voice.pannerNode.disconnect();
      }
    } catch {
      /* ignore */
    }
  }

  private removePositionalVoice(voice: PositionalVoice): void {
    const idx = this.activePositionalVoices.indexOf(voice);
    if (idx !== -1) {
      this.activePositionalVoices.splice(idx, 1);
    }
    if (voice.key && this.keyedLoops.get(voice.key) === voice) {
      this.keyedLoops.delete(voice.key);
    }
  }

  public startLoop3d(
    key: string,
    id: string,
    pos: { x: number; y: number; z: number },
    options?: Play3dOptions,
  ): PositionalVoice | null {
    const existing = this.keyedLoops.get(key);
    if (existing && !existing.stopped) {
      this.updateLoop3d(key, pos, options);
      return existing;
    }
    return this.play3d(id, pos, { ...options, key, loop: true });
  }

  public updateLoop3d(
    key: string,
    pos: { x: number; y: number; z: number },
    options?: { pitch?: number; volume?: number },
  ): void {
    const voice = this.keyedLoops.get(key);
    if (!voice || voice.stopped) return;
    voice.x = pos.x;
    voice.y = pos.y;
    voice.z = pos.z;
    this.setPannerPosition(voice.pannerNode, pos.x, pos.y, pos.z);

    if (options?.pitch !== undefined) {
      voice.source.playbackRate.value = options.pitch;
    }
    if (options?.volume !== undefined && this.ctx) {
      const baseGain = this.gainOf(voice.id);
      voice.gainNode.gain.setTargetAtTime(baseGain * options.volume, this.ctx.currentTime, 0.05);
    }
  }

  public stopLoop3d(key: string, fadeSeconds = 0.05): void {
    const voice = this.keyedLoops.get(key);
    if (voice) {
      this.stopVoice(voice, fadeSeconds);
      this.removePositionalVoice(voice);
    }
  }

  // ---------------------------------------------------------------------------
  // Dedicated Triggers for Game Moments
  // ---------------------------------------------------------------------------

  // The Lab Power-on sequence
  public playBreaker(pos = { x: -7.4, y: 1.0, z: -1.0 }): void {
    this.play3d('sfx-breaker', pos, { volume: 1.0 });
  }

  public playRelay(pos = { x: -7.6, y: 1.0, z: -3.5 }, pitch = 1.0): void {
    this.play3d('sfx-relay', pos, { volume: 1.0, pitch });
  }

  public playLever(pos = { x: -6.5, y: 1.0, z: -7.8 }): void {
    this.play3d('sfx-lever', pos, { volume: 1.0 });
  }

  public startCapacitorHum(pos = { x: -7.2, y: 1.0, z: 1.0 }): void {
    this.startLoop3d('capacitor-hum', 'sfx-capacitor-hum', pos, { volume: 0.9 });
  }

  public playGateSpool(pos = { x: 0, y: 1.0, z: -1.0 }): void {
    this.play3d('sfx-gate-spool', pos, { volume: 1.0 });
  }

  public startGateHum(pos = { x: 0, y: 1.0, z: -1.0 }): void {
    this.startLoop3d('gate-hum', 'sfx-gate-hum', pos, { volume: 0.85 });
  }

  public startStormLoop(pos = { x: 0, y: 2.0, z: -9.0 }, volume = 0.8): void {
    this.startLoop3d('storm', 'sfx-storm', pos, { volume });
  }

  public updateStormVolume(stormIntensity: number): void {
    // storm clears as progress rises -> stormIntensity = 1 - progress
    const vol = Math.max(0.01, Math.min(1.0, stormIntensity));
    this.updateLoop3d('storm', { x: 0, y: 2.0, z: -9.0 }, { volume: vol });
  }

  // Base Building SFX
  public playPlace(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-place', pos);
  }

  public playRefuse(): void {
    this.play2d('sfx-refuse', { volume: 0.9 });
  }

  public playCollapse(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-collapse', pos, { volume: 1.0 });
  }

  public playWeld(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-weld', pos, { volume: 0.95 });
  }

  public playDoor(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-door', pos);
  }

  public playAirlock(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-airlock', pos);
  }

  // Machines SFX
  public startMachineLoop(machineId: number | string, kind: string, pos: { x: number; y: number; z: number }): void {
    const key = `machine-${machineId}`;
    if (kind === 'mill' || kind.includes('mill')) {
      this.startLoop3d(key, 'sfx-mill', pos);
    } else if (kind === 'projector' || kind.includes('projector')) {
      this.startLoop3d(key, 'sfx-projector', pos);
    } else if (kind === 'watermaker' || kind.includes('watermaker')) {
      this.startLoop3d(key, 'sfx-watermaker', pos);
    } else if (kind === 'fabricator' || kind.includes('fabricator')) {
      this.startLoop3d(key, 'sfx-fabricator', pos);
    }
  }

  public stopMachineLoop(machineId: number | string): void {
    this.stopLoop3d(`machine-${machineId}`);
  }

  public playPressStroke(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-press', pos);
  }

  // Harvesting SFX
  public startBeamLoop(pos: { x: number; y: number; z: number }): void {
    this.startLoop3d('beam-extract', 'sfx-beam', pos, { volume: 0.9 });
  }

  public stopBeamLoop(): void {
    this.stopLoop3d('beam-extract');
  }

  public playPickup(grade: 1 | 2 | 3, pos?: { x: number; y: number; z: number }): void {
    const id = grade === 3 ? 'sfx-pickup-3' : grade === 2 ? 'sfx-pickup-2' : 'sfx-pickup-1';
    if (pos) {
      this.play3d(id, pos, { volume: 0.9 });
    } else {
      this.play2d(id, { volume: 0.9 });
    }
  }

  // Weapons SFX
  public playWeaponFire(mode: 'semi' | 'burst' | 'beam', pos?: { x: number; y: number; z: number }): void {
    if (mode === 'beam') {
      if (pos) {
        this.startLoop3d('weapon-beam', 'sfx-fire-beam', pos);
      } else {
        this.startLoop3d('weapon-beam', 'sfx-fire-beam', { x: this.listenerX, y: this.listenerY, z: this.listenerZ });
      }
    } else if (mode === 'burst') {
      if (pos) this.play3d('sfx-fire-burst', pos);
      else this.play2d('sfx-fire-burst');
    } else {
      if (pos) this.play3d('sfx-fire-semi', pos);
      else this.play2d('sfx-fire-semi');
    }
  }

  public stopWeaponBeam(): void {
    this.stopLoop3d('weapon-beam');
  }

  public playWeaponReload(pos?: { x: number; y: number; z: number }): void {
    if (pos) this.play3d('sfx-reload', pos);
    else this.play2d('sfx-reload');
  }

  public playWeaponEmpty(pos?: { x: number; y: number; z: number }): void {
    if (pos) this.play3d('sfx-empty', pos);
    else this.play2d('sfx-empty');
  }

  // Rovers SFX
  public startRoverMotor(vehicleId: number | string, kind: 'scout' | 'hauler' | 'crawler', pos: { x: number; y: number; z: number }): void {
    const key = `rover-${vehicleId}`;
    const id = kind === 'hauler' ? 'sfx-motor-hauler' : kind === 'crawler' ? 'sfx-motor-crawler' : 'sfx-motor-scout';
    this.startLoop3d(key, id, pos, { pitch: 1.0, volume: 0.85 });
  }

  public updateRoverMotor(vehicleId: number | string, pos: { x: number; y: number; z: number }, speed = 0, maxSpeed = 16): void {
    const key = `rover-${vehicleId}`;
    const ratio = Math.max(0, Math.min(1.5, speed / Math.max(1, maxSpeed)));
    const pitch = 0.8 + ratio * 0.5; // ~0.8 to 1.3
    this.updateLoop3d(key, pos, { pitch });
  }

  public stopRoverMotor(vehicleId: number | string): void {
    this.stopLoop3d(`rover-${vehicleId}`);
  }

  public playRoverSkid(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-skid', pos, { volume: 0.85 });
  }

  public playRoverImpact(pos: { x: number; y: number; z: number }): void {
    this.play3d('sfx-impact', pos, { volume: 1.0 });
  }

  // UI SFX
  public playUiHover(): void {
    this.play2d('sfx-ui-hover', { volume: 0.7 });
  }

  public playUiSelect(): void {
    this.play2d('sfx-ui-select', { volume: 0.9 });
  }

  public playUiOpen(): void {
    this.play2d('sfx-ui-open', { volume: 0.85 });
  }

  public playUiClose(): void {
    this.play2d('sfx-ui-close', { volume: 0.85 });
  }

  private recordRecentSound(id: string): void {
    this.recentSoundLog.push(id);
    if (this.recentSoundLog.length > this.MAX_RECENT_LOG) {
      this.recentSoundLog.shift();
    }
  }

  // ---------------------------------------------------------------------------
  // Frame Update (Zero Allocations)
  // ---------------------------------------------------------------------------

  public update(
    dt: number,
    camX: number,
    camY: number,
    camZ: number,
    fwdX: number,
    fwdY: number,
    fwdZ: number,
    upX: number,
    upY: number,
    upZ: number,
  ): void {
    const t0 = performance.now();

    this.listenerX = camX;
    this.listenerY = camY;
    this.listenerZ = camZ;

    if (this.ctx) {
      const lis = this.ctx.listener;
      const now = this.ctx.currentTime;
      if ('positionX' in lis) {
        lis.positionX.setValueAtTime(camX, now);
        lis.positionY.setValueAtTime(camY, now);
        lis.positionZ.setValueAtTime(camZ, now);
        lis.forwardX.setValueAtTime(fwdX, now);
        lis.forwardY.setValueAtTime(fwdY, now);
        lis.forwardZ.setValueAtTime(fwdZ, now);
        lis.upX.setValueAtTime(upX, now);
        lis.upY.setValueAtTime(upY, now);
        lis.upZ.setValueAtTime(upZ, now);
      } else {
        (lis as any).setPosition(camX, camY, camZ);
        (lis as any).setOrientation(fwdX, fwdY, fwdZ, upX, upY, upZ);
      }
    }

    // Monster mash calm countdown
    if (!this.mobsEngaged && this.currentContext === 'monster-mash') {
      this.calmTimer += dt;
      if (this.calmTimer >= 10.0) {
        if (!this.isDriving) {
          this.setMusicContext('moon', 2.0);
        }
      }
    }

    // In-place cleanup of finished voices (no array allocation)
    let writeIdx = 0;
    for (let i = 0; i < this.activePositionalVoices.length; i++) {
      const v = this.activePositionalVoices[i]!;
      if (!v.stopped) {
        this.activePositionalVoices[writeIdx++] = v;
      }
    }
    this.activePositionalVoices.length = writeIdx;

    this.lastCpuTimeMs = performance.now() - t0;
    this.avgCpuTimeMs = this.avgCpuTimeMs * 0.95 + this.lastCpuTimeMs * 0.05;
  }

  // ---------------------------------------------------------------------------
  // Debug Inspection Hook (window.__audio)
  // ---------------------------------------------------------------------------

  private setupDebugHook(): void {
    if (typeof window === 'undefined') return;
    (window as any).__audio = {
      getContext: () => this.ctx,
      getBuses: () => ({
        master: this.masterGain?.gain.value ?? 0,
        music: this.musicBus?.gain.value ?? 0,
        effects: this.sfxBus?.gain.value ?? 0,
        dialogue: this.dialogueBus?.gain.value ?? 0,
        duck: this.musicDuckGain?.gain.value ?? 1,
      }),
      getMusicContext: () => this.currentContext,
      getMoonWeights: () => [...this.moonWeights],
      getVoices: () =>
        this.activePositionalVoices.map((v) => ({
          id: v.id,
          key: v.key,
          gain: v.gainNode.gain.value,
          pos: { x: v.x, y: v.y, z: v.z },
          loop: v.loop,
          stopped: v.stopped,
        })),
      getRecentSounds: () => [...this.recentSoundLog],
      getCpuTimeMs: () => this.lastCpuTimeMs,
      getAvgCpuTimeMs: () => this.avgCpuTimeMs,
      // Debug action helpers
      setMoonStage: (s: number) => this.setMoonStage(s),
      setMusicContext: (c: MusicContext) => this.setMusicContext(c),
      duckMusic: (d: boolean) => this.duckMusic(d),
      play2d: (id: string, opt?: any) => this.play2d(id, opt),
      play3d: (id: string, pos: any, opt?: any) => this.play3d(id, pos, opt),
    };
  }
}

// Global shared singleton
export const gameAudio = new GameAudioController();
