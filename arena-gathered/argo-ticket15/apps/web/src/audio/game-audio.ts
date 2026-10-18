// Comprehensive game audio engine for FIDELITY / SetMix (TASK-12; five buses in TASK-29 part A).
// Architecture: five buses, each with its own level (Settings), feeding the master.
//   voice (Dr. Haddy's chain, never ducked) | combat and UI | world SFX (bit-depth mirror, low-pass while she speaks)
//   | ambience (stage beds, reverb from stage 4) | music (context sub-buses, Moon score, ducks under her lines).
//   Every source plays on exactly one bus: @hm/audiomix busOfSound. While she speaks the non-voice buses duck by
//   @hm/audiomix DUCK (80 ms attack, 450 ms release).
// - Loading strategy: Decode 36 SFX and lab music at startup; decode 7 Moon tracks,
//   Monster Mash, and driving music behind gate transition / before first Moon visit.
// - Equal-power Moon score stage crossfading (tracks music-moon-s0..s6).
// - Context music: lab, moon, monster mash (mobs engage), driving (in rover).
// - Positional SFX engine: max 8 positional voices using PannerNode (equalpower), voice stealing for farthest.
// - Stage ambience (setAmbience): procedural beds from @hm/soundscape, on the ambience bus.
// - No autoplay (POL-72): the world and ambience buses stay at zero gain until the first pointer or key press, or the lab.
// - Zero allocations in audio update loop.
// - window.__audio debug inspection hook (created with the controller, so it exists before the first sound).

import { kv } from '../storage/profile-storage';
import { BUS_IDS, BUS_START, DUCK, busOfSound, crushForStage, dbToGain, type BusId, type Crush } from '@hm/audiomix';
import { ambiencePlan, reverbImpulse, whiteNoise, type AmbienceLayer, type AmbiencePlan, type AmbienceQuery } from '@hm/soundscape';
import { BITCRUSH_PROCESSOR, bitcrushModuleUrl } from './bitcrush-worklet';

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

/** One level per bus, 0..1 (linear). `effects` is the world SFX bus; `dialogue` is the voice bus. */
export interface AudioSettings {
  master: number; // 0..1, default 1.0
  music: number; // 0..1, default 0.45 (the owner's music fader)
  effects: number; // the world SFX bus, default -6 dB
  dialogue: number; // the voice bus, default 0.8 (the owner's voice fader)
  combatUi: number; // default -4 dB
  ambience: number; // default -12 dB
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1.0,
  music: BUS_START.music,
  effects: BUS_START.world,
  dialogue: BUS_START.voice,
  combatUi: BUS_START.combatUi,
  ambience: BUS_START.ambience,
};

/** The saved setting behind each bus. */
const SETTING_OF: Readonly<Record<BusId, keyof AudioSettings>> = {
  voice: 'dialogue',
  combatUi: 'combatUi',
  world: 'effects',
  ambience: 'ambience',
  music: 'music',
};

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** A linear ramp from the parameter's current value to `target` over `seconds` (a clean duck, never a jump). */
function rampTo(p: AudioParam, target: number, now: number, seconds: number): void {
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + seconds);
}

/** The RMS level of an analyser's last block, in dB (-200 for silence or no tap). */
function rmsDb(a: AnalyserNode | undefined): number {
  if (!a) return -200;
  const buf = new Float32Array(a.fftSize);
  a.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += (buf[i] ?? 0) * (buf[i] ?? 0);
  const r = Math.sqrt(s / buf.length);
  return r > 0 ? 20 * Math.log10(r) : -200;
}

/** One stage ambience layer on the ambience bus: a source, its filter, the level and the LFO that breathes it. */
interface AmbienceVoice {
  readonly source: AudioScheduledSourceNode;
  readonly filter: BiquadFilterNode;
  readonly gain: GainNode;
  readonly lfo: OscillatorNode;
  readonly lfoDepth: GainNode;
}

/** A file shipped beside index.html, relative to the page (a root path breaks under a sub-path, and from disk names the drive root). */
const besidePage = (p: string): string => new URL(p, document.baseURI).href;
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

export type MusicContext = 'silent' | 'lab' | 'moon' | 'monsters' | 'driving';

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
  /** The bus, when it is not the one the sound id maps to (busOfSound). */
  bus?: BusId;
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
  /** The bus, when it is not the one the sound id maps to (busOfSound). */
  bus?: BusId;
}

export class GameAudioController {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;

  // Master & Bus Nodes (the five buses; each bus's level is the gain node named after it)
  private masterGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  /** The world SFX bus (the Settings' Effects slider). */
  private sfxBus: GainNode | null = null;
  /** The voice bus (Dr. Haddy's chain). */
  private dialogueBus: GainNode | null = null;
  private combatBus: GainNode | null = null;
  private combatDuck: GainNode | null = null;
  private worldDuck: GainNode | null = null;
  private worldLp: BiquadFilterNode | null = null;
  private worldGate: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private ambienceDuck: GainNode | null = null;
  private ambienceGate: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private reverbLp: BiquadFilterNode | null = null;
  private reverb: ConvolverNode | null = null;
  /** The bit-depth mirror (DEC-07): crushIn -> [worklet] -> crushOut, on the world SFX bus only. */
  private crushIn: GainNode | null = null;
  private crushOut: GainNode | null = null;
  private crushNode: AudioWorkletNode | null = null;
  private crushMode: 'pending' | 'worklet' | 'bypass' = 'pending';
  private crushNow: Crush | null = null;
  private stage = 0;
  /** Analysers after each bus (debug and the browser check only). */
  private taps: Partial<Record<BusId | 'crushed', AnalyserNode>> = {};

  /** No autoplay (POL-72): world and ambience stay silent until the first press, or the lab. */
  private worldOpen = false;

  // Stage ambience (setAmbience)
  private ambienceVoices = new Map<string, AmbienceVoice>();
  private ambiencePlanNow: AmbiencePlan | null = null;
  private stormBed: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private noiseBuffers: AudioBuffer[] | null = null;

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
    this.setupDebugHook();
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
    const open = this.worldOpen ? 1 : 0;

    // Voice bus: Dr. Haddy's chain plugs in here. It never ducks.
    this.dialogueBus = c.createGain();
    this.dialogueBus.gain.value = this.settings.dialogue;
    this.tap('voice', this.dialogueBus);

    // Combat and UI bus: weapons and the interface. It ducks 2 dB under her.
    this.combatBus = c.createGain();
    this.combatBus.gain.value = this.settings.combatUi;
    this.combatDuck = c.createGain();
    this.combatBus.connect(this.combatDuck);
    this.tap('combatUi', this.combatDuck);

    // World SFX bus: the bit-depth mirror sits here and nowhere else. It ducks 6.5 dB with a 1.8 kHz low-pass.
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = this.settings.effects;
    this.crushIn = c.createGain();
    this.crushOut = c.createGain();
    this.sfxBus.connect(this.crushIn);
    this.crushIn.connect(this.crushOut); // straight through until the worklet is in (installBitcrush)
    this.worldDuck = c.createGain();
    this.worldLp = c.createBiquadFilter();
    this.worldLp.type = 'lowpass';
    this.worldLp.frequency.value = DUCK.worldLowpassOpenHz;
    this.worldLp.Q.value = 0.707;
    this.worldGate = c.createGain();
    this.worldGate.gain.value = open;
    // 'crushed' is the probe right after the bit-depth mirror: its samples sit on the crush grid, untouched by the filter and the duck
    const probe = c.createAnalyser();
    probe.fftSize = 2048;
    this.taps.crushed = probe;
    this.crushOut.connect(probe).connect(this.worldDuck);
    this.worldDuck.connect(this.worldLp).connect(this.worldGate);
    this.tap('world', this.worldGate);
    void this.installBitcrush(c);

    // Ambience bus: the stage's procedural beds. It ducks 5 dB; a warm reverb joins it from stage 4.
    this.ambienceBus = c.createGain();
    this.ambienceBus.gain.value = this.settings.ambience;
    this.ambienceDuck = c.createGain();
    this.ambienceGate = c.createGain();
    this.ambienceGate.gain.value = open;
    this.reverbSend = c.createGain();
    this.reverbSend.gain.value = 0;
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.reverbBuffer(c);
    this.reverbLp = c.createBiquadFilter();
    this.reverbLp.type = 'lowpass';
    this.reverbLp.frequency.value = 2400;
    this.ambienceBus.connect(this.ambienceDuck);
    this.ambienceBus.connect(this.reverbSend).connect(this.reverb).connect(this.reverbLp).connect(this.ambienceDuck);
    this.ambienceDuck.connect(this.ambienceGate);
    this.tap('ambience', this.ambienceGate);

    // Music Ducking Node (ducks under Dr. Haddy's lines)
    this.musicDuckGain = c.createGain();
    this.musicDuckGain.gain.value = 1.0;
    this.tap('music', this.musicDuckGain);

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

    this.applyCrush();
  }

  /** A bus's output goes through an analyser (a pass-through) to the master. The browser check reads these. */
  private tap(bus: BusId, from: AudioNode): void {
    if (!this.ctx || !this.masterGain) return;
    const a = this.ctx.createAnalyser();
    a.fftSize = 2048;
    this.taps[bus] = a;
    from.connect(a).connect(this.masterGain);
  }

  /** Two seconds of reverb tail from a seeded noise: the same every time. */
  private reverbBuffer(c: AudioContext): AudioBuffer {
    const data = reverbImpulse(2.2, c.sampleRate, 0x51ed270b);
    const buf = c.createBuffer(1, data.length, c.sampleRate);
    buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    return buf;
  }

  /**
   * The bit-depth mirror (DEC-07). Its module is a Blob URL from an inline string (bitcrush-worklet.ts), so it loads from the
   * built single file over http and from disk. If the browser refuses it, the world bus plays at full depth.
   */
  private async installBitcrush(c: AudioContext): Promise<void> {
    try {
      // a worklet that never settles counts as refused: the world bus then plays at full depth instead of waiting
      await Promise.race([
        c.audioWorklet.addModule(bitcrushModuleUrl()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('worklet load timed out')), 5000)),
      ]);
      const node = new AudioWorkletNode(c, BITCRUSH_PROCESSOR, { numberOfInputs: 1, numberOfOutputs: 1 });
      if (this.crushIn && this.crushOut) {
        this.crushIn.disconnect(this.crushOut);
        this.crushIn.connect(node).connect(this.crushOut);
      }
      this.crushNode = node;
      this.crushMode = 'worklet';
      this.applyCrush();
    } catch (e) {
      this.crushMode = 'bypass';
      console.warn('[game-audio] Bit-depth mirror unavailable; world SFX play at full depth:', e);
    }
  }

  /**
   * The crush now: the stage's (0 to 2 crush, 3 and up full), and full in the lab, which is the shielded room on Earth and not
   * part of the terraforming.
   */
  private applyCrush(): void {
    this.crushNow = this.currentContext === 'lab' ? null : crushForStage(this.stage);
    if (!this.crushNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.crushNode.parameters.get('rate')?.setValueAtTime(this.crushNow?.rateHz ?? this.ctx.sampleRate, now);
    this.crushNode.parameters.get('bits')?.setValueAtTime(this.crushNow?.bits ?? 16, now);
  }

  /** The Fidelity stage for the world SFX's bit-depth mirror (0 to 6). Driven by setMoonStage too, which the play screen calls. */
  public setStage(stage: number): void {
    this.stage = Number.isFinite(stage) ? Math.min(6, Math.max(0, Math.floor(stage))) : 0;
    this.applyCrush();
  }

  /** Open the world and ambience buses (the first pointer or key press, or the lab). Idempotent. */
  public unlockWorldAudio(): void {
    if (this.worldOpen) return;
    this.worldOpen = true;
    if (this.ctx) {
      void this.ctx.resume();
      const now = this.ctx.currentTime;
      this.worldGate?.gain.setTargetAtTime(1, now, 0.25);
      this.ambienceGate?.gain.setTargetAtTime(1, now, 0.25);
    }
  }

  /** The node a sound on `bus` plays into. */
  private busNode(bus: BusId): AudioNode {
    this.getContext();
    switch (bus) {
      case 'voice': return this.dialogueBus!;
      case 'combatUi': return this.combatBus!;
      case 'world': return this.sfxBus!;
      case 'ambience': return this.ambienceBus!;
      case 'music': return this.musicBus!;
    }
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

  public getCombatBus(): AudioNode {
    this.getContext();
    return this.combatBus!;
  }

  public getAmbienceBus(): AudioNode {
    this.getContext();
    return this.ambienceBus!;
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

  /** Set one bus's level (0..1), save it, and move the bus now. */
  public setBusVolume(bus: BusId, vol: number): void {
    const v = clamp01(vol);
    const key = SETTING_OF[bus];
    (this.settings as unknown as Record<string, number>)[key] = v;
    saveAudioSettings({ [key]: v } as Partial<AudioSettings>);
    const node = this.busLevelNode(bus);
    if (node && this.ctx) node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private busLevelNode(bus: BusId): GainNode | null {
    switch (bus) {
      case 'voice': return this.dialogueBus;
      case 'combatUi': return this.combatBus;
      case 'world': return this.sfxBus;
      case 'ambience': return this.ambienceBus;
      case 'music': return this.musicBus;
    }
  }

  public setMusicVolume(vol: number): void {
    this.setBusVolume('music', vol);
  }

  /** The world SFX bus (the Settings' Effects slider). */
  public setEffectsVolume(vol: number): void {
    this.setBusVolume('world', vol);
  }

  /** The voice bus. */
  public setDialogueVolume(vol: number): void {
    this.setBusVolume('voice', vol);
  }

  public setCombatUiVolume(vol: number): void {
    this.setBusVolume('combatUi', vol);
  }

  public setAmbienceVolume(vol: number): void {
    this.setBusVolume('ambience', vol);
  }

  /**
   * While she speaks (true) or when she stops (false): every bus but the voice ducks by its DUCK depth. The attack is 80 ms and
   * the release 450 ms (linear ramps, @hm/audiomix). The world bus also drops its low-pass to 1.8 kHz while she talks.
   */
  public duckMusic(ducked: boolean): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const seconds = ducked ? DUCK.attackS : DUCK.releaseS;
    const nodes: Partial<Record<BusId, GainNode | null>> = { combatUi: this.combatDuck, world: this.worldDuck, ambience: this.ambienceDuck, music: this.musicDuckGain };
    for (const bus of BUS_IDS) {
      const node = nodes[bus];
      if (!node) continue;
      rampTo(node.gain, ducked ? dbToGain(DUCK.depthDb[bus]) : 1, now, seconds);
    }
    if (this.worldLp) rampTo(this.worldLp.frequency, ducked ? DUCK.worldLowpassHz : DUCK.worldLowpassOpenHz, now, seconds);
  }

  // ---------------------------------------------------------------------------
  // Asset Loading & Metadata
  // ---------------------------------------------------------------------------

  public async fetchMetadata(): Promise<void> {
    if (Object.keys(this.levels).length > 0 && this.entries.length > 0) return;
    try {
      const [levelsRes, indexRes] = await Promise.all([
        fetch(besidePage('audio/levels.json')),
        fetch(besidePage('audio/index.json')),
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
        const res = await fetch(besidePage(`audio/${id}.mp3`));
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
    this.stopAmbience();
    this.applyCrush();
    if (this.ctx) {
      const now = this.ctx.currentTime;
      for (const node of [this.musicDuckGain, this.combatDuck, this.worldDuck, this.ambienceDuck]) {
        node?.gain.cancelScheduledValues(now);
        node?.gain.setValueAtTime(1, now);
      }
      this.worldLp?.frequency.cancelScheduledValues(now);
      this.worldLp?.frequency.setValueAtTime(DUCK.worldLowpassOpenHz, now);
    }
  }

  public setMusicContext(context: MusicContext, crossfadeSeconds = 1.5): void {
    if (this.currentContext === context) return;
    this.currentContext = context;
    // entering the lab opens the world and ambience buses (POL-72); the lab itself is never crushed
    if (context === 'lab') this.unlockWorldAudio();
    this.applyCrush();
    this.applyMusicContextCrossfade(crossfadeSeconds);
  }

  private applyMusicContextCrossfade(fadeSeconds: number): void {
    if (!this.ctx || !this.labMusicGain || !this.moonGroupGain || !this.mashMusicGain || !this.drivingMusicGain) return;
    const now = this.ctx.currentTime;
    const tc = Math.max(0.08, fadeSeconds / 3);

    // Target gains based on context
    const labTarget = this.currentContext === 'lab' ? 1.0 : 0.0;
    const moonTarget = this.currentContext === 'moon' ? 1.0 : 0.0;
    const mashTarget = this.currentContext === 'monsters' ? 1.0 : 0.0;
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
    } else if (this.currentContext === 'monsters') {
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
    // the same stage drives the bit-depth mirror on the world SFX bus
    this.setStage(this.currentStage);
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
        this.setMusicContext('monsters', 2.0);
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
        this.setMusicContext('monsters', 2.0);
      } else {
        this.setMusicContext('moon', 1.5);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stage Ambience (P1-SOUND-03): procedural beds on the ambience bus, planned by @hm/soundscape
  // ---------------------------------------------------------------------------

  /**
   * The ambience for this place and moment: the lab's hum, vent and storm, or the planet's beds by stage and floats. Layers that
   * stay are retuned in place; layers that go fade out. Calling it again with the same answer changes nothing.
   */
  public setAmbience(q: AmbienceQuery): void {
    if (q.where === 'lab') this.unlockWorldAudio();
    const plan = ambiencePlan(q);
    this.ambiencePlanNow = plan;
    const c = this.getContext();
    const now = c.currentTime;

    const want = new Set(plan.layers.map((l) => l.id));
    for (const [id, v] of this.ambienceVoices) {
      if (want.has(id)) continue;
      this.retireAmbience(v, now);
      this.ambienceVoices.delete(id);
    }
    for (const layer of plan.layers) {
      let v = this.ambienceVoices.get(layer.id);
      if (!v) {
        v = this.createAmbienceVoice(c, layer, now);
        this.ambienceVoices.set(layer.id, v);
      }
      this.retuneAmbience(v, layer, now);
    }
    this.setStormBed(plan.storm, now);
    this.reverbSend?.gain.setTargetAtTime(plan.reverbWet, now, 0.5);
  }

  /** The ambience layers now playing (ids), and the storm bed and reverb, for the browser check. */
  public getAmbience(): { layers: string[]; storm: boolean; reverbWet: number } {
    return {
      layers: this.ambiencePlanNow?.layers.map((l) => l.id) ?? [],
      storm: this.ambiencePlanNow?.storm !== null && this.ambiencePlanNow?.storm !== undefined,
      reverbWet: this.ambiencePlanNow?.reverbWet ?? 0,
    };
  }

  private stopAmbience(): void {
    for (const v of this.ambienceVoices.values()) this.retireAmbience(v, this.ctx?.currentTime ?? 0, 0);
    this.ambienceVoices.clear();
    this.ambiencePlanNow = null;
    if (this.stormBed) {
      try { this.stormBed.src.stop(); } catch { /* already stopped */ }
      this.stormBed.src.disconnect();
      this.stormBed = null;
    }
    this.reverbSend?.gain.setValueAtTime(0, this.ctx?.currentTime ?? 0);
  }

  /** A noise source's buffer: three seeded two-second buffers, shared by the layers (each starts at its own offset). */
  private noiseBuffer(c: AudioContext, id: string): { buffer: AudioBuffer; offsetS: number } {
    if (!this.noiseBuffers) {
      this.noiseBuffers = [0x1234567, 0x7654321, 0x0badf00d].map((seed) => {
        const n = c.sampleRate * 2;
        const b = c.createBuffer(1, n, c.sampleRate);
        b.copyToChannel(whiteNoise(n, seed) as Float32Array<ArrayBuffer>, 0);
        return b;
      });
    }
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const buffer = this.noiseBuffers[h % 3]!;
    return { buffer, offsetS: ((h >>> 3) % 97) / 97 * 1.9 };
  }

  private createAmbienceVoice(c: AudioContext, layer: AmbienceLayer, now: number): AmbienceVoice {
    const gain = c.createGain();
    gain.gain.value = 0;
    const filter = c.createBiquadFilter();
    filter.type = layer.filter;
    filter.frequency.value = layer.cutoff;
    filter.Q.value = 0.8;
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = layer.lfoHz;
    const lfoDepth = c.createGain();
    lfo.connect(lfoDepth).connect(gain.gain);

    let source: AudioScheduledSourceNode;
    if (layer.wave === 'noise') {
      const { buffer, offsetS } = this.noiseBuffer(c, layer.id);
      const s = c.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.start(now, offsetS);
      source = s;
    } else {
      const o = c.createOscillator();
      o.type = layer.wave;
      o.frequency.value = layer.freq;
      o.start(now);
      source = o;
    }
    source.connect(filter).connect(gain).connect(this.ambienceBus!);
    lfo.start(now);
    return { source, filter, gain, lfo, lfoDepth };
  }

  /** The base level is the layer's gain less half its LFO depth; the LFO swings it by that half either way. */
  private retuneAmbience(v: AmbienceVoice, layer: AmbienceLayer, now: number): void {
    const d = layer.lfoDepth;
    v.gain.gain.setTargetAtTime(layer.gain * (1 - d / 2), now, 0.6);
    v.lfoDepth.gain.setTargetAtTime((layer.gain * d) / 2, now, 0.6);
    v.filter.frequency.setTargetAtTime(layer.cutoff, now, 0.6);
    v.filter.type = layer.filter;
    v.lfo.frequency.setTargetAtTime(layer.lfoHz, now, 0.6);
  }

  /** Fade a layer out, stop it, and take its nodes out of the graph a moment later. */
  private retireAmbience(v: AmbienceVoice, now: number, fadeS = 0.4): void {
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setTargetAtTime(0, now, Math.max(0.001, fadeS / 3));
    try { v.source.stop(now + fadeS + 0.5); v.lfo.stop(now + fadeS + 0.5); } catch { /* already stopped */ }
    setTimeout(() => {
      for (const n of [v.source, v.filter, v.gain, v.lfo, v.lfoDepth] as AudioNode[]) {
        try { n.disconnect(); } catch { /* already gone */ }
      }
    }, (fadeS + 0.6) * 1000);
  }

  /** The lab's muffled storm: the approved storm sound, low-passed and looped, on the ambience bus. */
  private setStormBed(storm: AmbiencePlan['storm'], now: number): void {
    if (!storm) {
      if (this.stormBed) {
        this.stormBed.gain.gain.setTargetAtTime(0, now, 0.2);
        const old = this.stormBed;
        this.stormBed = null;
        try { old.src.stop(now + 1.2); } catch { /* already stopped */ }
      }
      return;
    }
    if (!this.stormBed) {
      const buf = this.getBuffer('sfx-storm');
      if (!buf) {
        void this.loadBuffer('sfx-storm').then(() => {
          const pending = this.ambiencePlanNow?.storm;
          if (pending && this.ctx && !this.stormBed) this.setStormBed(pending, this.ctx.currentTime);
        });
        return;
      }
      const c = this.getContext();
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.applyLoopRegion(src, 'sfx-storm');
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.7;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.ambienceBus!);
      src.start(now);
      this.stormBed = { src, filter, gain };
    }
    this.stormBed.filter.frequency.setTargetAtTime(storm.cutoffHz, now, 0.5);
    this.stormBed.gain.gain.setTargetAtTime(storm.gain * this.gainOf('sfx-storm'), now, 0.5);
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

    src.connect(gain).connect(this.busNode(options?.bus ?? busOfSound(id)));
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

    src.connect(gain).connect(panner).connect(this.busNode(options?.bus ?? busOfSound(id)));
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
    if (!this.mobsEngaged && this.currentContext === 'monsters') {
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
      getContext: () => this.getContext(),
      getBuses: () => ({
        master: this.masterGain?.gain.value ?? 0,
        music: this.musicBus?.gain.value ?? 0,
        effects: this.sfxBus?.gain.value ?? 0,
        dialogue: this.dialogueBus?.gain.value ?? 0,
        duck: this.musicDuckGain?.gain.value ?? 1,
        combatUi: this.combatBus?.gain.value ?? 0,
        ambience: this.ambienceBus?.gain.value ?? 0,
        duckWorld: this.worldDuck?.gain.value ?? 1,
        duckCombatUi: this.combatDuck?.gain.value ?? 1,
        duckAmbience: this.ambienceDuck?.gain.value ?? 1,
        worldLowpassHz: this.worldLp?.frequency.value ?? DUCK.worldLowpassOpenHz,
      }),
      /** RMS per bus after its duck, in dB (-200 for silence): the measured duck and gates. */
      getBusLevels: () => {
        const out: Record<string, number> = {};
        for (const bus of BUS_IDS) out[bus] = rmsDb(this.taps[bus]);
        return out;
      },
      /** The gates: 0 until the first press or the lab (POL-72). */
      getGates: () => ({ world: this.worldGate?.gain.value ?? 0, ambience: this.ambienceGate?.gain.value ?? 0, open: this.worldOpen }),
      /** The bit-depth mirror: the worklet's state, and the crush it is set to now (null is full depth). */
      getCrush: () => ({ mode: this.crushMode, stage: this.stage, crush: this.crushNow, sampleRate: this.ctx?.sampleRate ?? 0 }),
      setStage: (s: number) => this.setStage(s),
      /** The last block of a tap ('voice' ... 'music', or 'crushed'), as samples. */
      sampleTap: (name: string): number[] => {
        const a = this.taps[name as BusId | 'crushed'];
        if (!a) return [];
        const b = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(b);
        return Array.from(b);
      },
      loadBuffer: async (id: string): Promise<boolean> => !!(await this.loadBuffer(id)),
      unlock: () => this.unlockWorldAudio(),
      setAmbience: (q: AmbienceQuery) => this.setAmbience(q),
      getAmbience: () => this.getAmbience(),
      setBusVolume: (bus: BusId, v: number) => this.setBusVolume(bus, v),
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
      playChoirStep: (state: any, bus?: 'world' | 'music') => this.playChoirStep(state, bus),
      playBridgeFmNote: (freqHz: number, arrangement?: string, bus?: 'music' | 'world') => this.playBridgeFmNote(freqHz, arrangement, bus),
      playTurboBassPulse: (downbeatPulse0to1?: number) => this.playTurboBassPulse(downbeatPulse0to1),
    };
  }

  // ---------------------------------------------------------------------------
  // TICKET-15 (Brief 34): T09a Bus-Routed Procedural Synths (0 MB Audio Payload)
  // - Choir & Bridge FM Radio -> 'music' or 'world' (never 'voice')
  // - [V] Turbo Bass Pulse -> 'combatUi' (never 'voice')
  // ---------------------------------------------------------------------------

  public playChoirStep(
    state: {
      readonly stemGains: Readonly<Record<string, number>>;
      readonly currentFreqHz: Readonly<Record<string, number>>;
      readonly isHarmonicConvergenceLocked: boolean;
    },
    bus: 'world' | 'music' = state.isHarmonicConvergenceLocked ? 'music' : 'world',
  ): void {
    const safeBus: BusId = bus === 'music' ? 'music' : 'world';
    try {
      const c = this.getContext();
      const targetNode = this.busNode(safeBus);
      const now = c.currentTime;
      const roles: readonly { readonly role: string; readonly type: OscillatorType; readonly dur: number; readonly gainScale: number }[] = [
        { role: 'shape-press-bass', type: 'triangle', dur: 0.28, gainScale: 0.16 },
        { role: 'texture-mill-arp', type: 'square', dur: 0.11, gainScale: 0.08 },
        { role: 'light-projector-pad', type: 'sawtooth', dur: 0.36, gainScale: 0.10 },
        { role: 'water-maker-lead', type: 'sine', dur: 0.22, gainScale: 0.14 },
      ];
      for (const r of roles) {
        const gVal = state.stemGains[r.role] ?? 0;
        const freq = state.currentFreqHz[r.role] ?? 0;
        if (gVal <= 0.05 || freq <= 20) continue;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = r.type;
        osc.frequency.setValueAtTime(freq, now);
        const peak = Math.min(0.25, gVal * r.gainScale);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + r.dur);
        osc.connect(gain).connect(targetNode);
        osc.start(now);
        osc.stop(now + r.dur + 0.02);
      }
      this.recordRecentSound(safeBus === 'music' ? 'synth-choir-convergence' : 'synth-choir-machine-step');
    } catch {
      // No-op if AudioContext unavailable in headless environment
    }
  }

  public playBridgeFmNote(
    freqHz: number,
    arrangement = 'stage4-lush-stereo-studio',
    bus: 'music' | 'world' = 'music',
  ): void {
    const safeBus: BusId = bus === 'world' ? 'world' : 'music';
    try {
      const c = this.getContext();
      const targetNode = this.busNode(safeBus);
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();

      if (arrangement === 'sstv-hidden-transmission') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1900, now + 0.06);
        osc.frequency.setValueAtTime(2300, now + 0.12);
      } else if (arrangement === 'stage0-8bit-chiptune') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(freqHz, now);
      } else if (arrangement === 'stage2-16bit-fm-synthwave') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqHz, now);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freqHz, now);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
      osc.connect(gain).connect(targetNode);
      osc.start(now);
      osc.stop(now + 0.22);
      this.recordRecentSound(`synth-radio-${arrangement}`);
    } catch {
      // No-op if AudioContext unavailable
    }
  }

  public playTurboBassPulse(downbeatPulse0to1 = 1.0): void {
    try {
      const c = this.getContext();
      // Strictly routed to T09a 'combatUi' bus (never 'voice')
      const combatTarget = this.busNode('combatUi');
      const now = c.currentTime;
      const boost = downbeatPulse0to1 >= 0.6 ? 1.25 : 1.0;

      const sub = c.createOscillator();
      const subGain = c.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110 * boost, now);
      sub.frequency.exponentialRampToValueAtTime(36.71, now + 0.38); // D1 sub-bass drop
      subGain.gain.setValueAtTime(0.42, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      sub.connect(subGain).connect(combatTarget);
      sub.start(now);
      sub.stop(now + 0.44);

      this.recordRecentSound('sfx-turbobass-pulse');
    } catch {
      // No-op if AudioContext unavailable
    }
  }
}

// Global shared singleton
export const gameAudio = new GameAudioController();

// No autoplay (POL-72): the first pointer or key press opens the world and ambience buses. Entering the lab does too (setMusicContext).
if (typeof window !== 'undefined') {
  const wake = (): void => gameAudio.unlockWorldAudio();
  window.addEventListener('pointerdown', wake, { capture: true, once: true });
  window.addEventListener('keydown', wake, { capture: true, once: true });
}
