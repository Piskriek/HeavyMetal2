// ============================================================================
// File: packages/audio/src/five-bus-mixer.ts
// Brief: Brief 29 (5-Bus Web Audio Mixer, VO Sidechain Ducking & Bit-Depth Mirror)
// Decision: DEC-07 (Bit-crush strictly on World_SFX_Bus; VO & UI always crisp)
// ============================================================================

export type AudioBusName = 'vo' | 'combatUi' | 'worldSfx' | 'ambience' | 'music';

export class FiveBusAudioMixer {
  public readonly ctx: AudioContext;
  public readonly masterCompressor: DynamicsCompressorNode;
  public readonly masterGain: GainNode;

  public readonly voBus: GainNode;
  public readonly combatUiBus: GainNode;
  public readonly worldSfxBus: GainNode;
  public readonly worldSfxFilter: BiquadFilterNode;
  public readonly worldSfxCrusher: WaveShaperNode;
  public readonly ambienceBus: GainNode;
  public readonly musicBus: GainNode;

  constructor(audioCtx?: AudioContext) {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = audioCtx ?? new AudioCtor();

    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -1.0;
    this.masterCompressor.ratio.value = 12.0;
    this.masterCompressor.attack.value = 0.003;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // 1. VO Bus (Dr. Haddy — always full clarity, triggers sidechain ducking)
    this.voBus = this.ctx.createGain();
    this.voBus.gain.value = 0.79; // -2.0 dBFS
    this.voBus.connect(this.masterCompressor);

    // 2. Combat & UI Bus (Always full 48 kHz clarity per DEC-07)
    this.combatUiBus = this.ctx.createGain();
    this.combatUiBus.gain.value = 0.63; // -4.0 dBFS
    this.combatUiBus.connect(this.masterCompressor);

    // 3. World SFX Bus (Stage-linked bit-depth & sample-rate mirror per DEC-07)
    this.worldSfxBus = this.ctx.createGain();
    this.worldSfxBus.gain.value = 0.50; // -6.0 dBFS
    this.worldSfxFilter = this.ctx.createBiquadFilter();
    this.worldSfxFilter.type = 'lowpass';
    this.worldSfxFilter.frequency.value = 20000;
    this.worldSfxCrusher = this.ctx.createWaveShaper();
    this.setStageAcousticFidelity(0);

    this.worldSfxBus.connect(this.worldSfxCrusher);
    this.worldSfxCrusher.connect(this.worldSfxFilter);
    this.worldSfxFilter.connect(this.masterCompressor);

    // 4. Ambience Bus
    this.ambienceBus = this.ctx.createGain();
    this.ambienceBus.gain.value = 0.25; // -12.0 dBFS
    this.ambienceBus.connect(this.masterCompressor);

    // 5. Music Bus (@hm/musicbox)
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.28; // -11.0 dBFS
    this.musicBus.connect(this.masterCompressor);
  }

  /**
   * Automatic Sidechain Ducking when Dr. Haddy (VO_Bus) starts/stops speaking (P0-SOUND-01).
   */
  public setVoiceoverActive(isSpeaking: boolean): void {
    const now = this.ctx.currentTime;
    const ramp = isSpeaking ? 0.08 : 0.45;
    this.worldSfxBus.gain.setTargetAtTime(isSpeaking ? 0.24 : 0.50, now, ramp);
    this.worldSfxFilter.frequency.setTargetAtTime(isSpeaking ? 1800 : this.currentStageCutoffHz, now, ramp);
    this.musicBus.gain.setTargetAtTime(isSpeaking ? 0.11 : 0.28, now, ramp);
    this.ambienceBus.gain.setTargetAtTime(isSpeaking ? 0.14 : 0.25, now, ramp);
  }

  private currentStageCutoffHz = 4000;

  /**
   * Updates World_SFX_Bus acoustic resolution from Stage 0 (8 kHz 4-bit) to Stage 3+ (48 kHz stereo).
   */
  public setStageAcousticFidelity(stageIndex0to6: number): void {
    const steps = stageIndex0to6 <= 0 ? 16 : stageIndex0to6 === 1 ? 64 : stageIndex0to6 === 2 ? 256 : 65536;
    this.currentStageCutoffHz =
      stageIndex0to6 <= 0 ? 3800 : stageIndex0to6 === 1 ? 5500 : stageIndex0to6 === 2 ? 11000 : 20000;

    this.worldSfxFilter.frequency.setTargetAtTime(this.currentStageCutoffHz, this.ctx.currentTime, 0.15);

    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = steps >= 65536 ? x : Math.round(x * (steps * 0.5)) / (steps * 0.5);
    }
    this.worldSfxCrusher.curve = curve;
  }

  /**
   * Procedural Action SFX: Beam Rifle Dry-Fire ("brrt" solenoid clack + buzz)
   */
  public playBeamDryFire(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.combatUiBus);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Procedural Action SFX: Sub-Bass Reinforcement Punch for 8-Bit @hm/shareware Weapons (P1-SOUND-05)
   */
  public playSharewareSubPunch(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(64, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.11);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.combatUiBus);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}
