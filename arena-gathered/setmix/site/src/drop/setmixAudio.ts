/* ============================================================================
 *  packages/audio/src/setmixAudio.ts
 *  ---------------------------------------------------------------------------
 *  THE PROCEDURAL AUDIO ENGINE.  Zero MP3. Zero WAV. Zero bytes of sample data.
 *
 *  Audio fidelity is bound to the Fidelity Index exactly as visual fidelity is.
 *  Players hear the planet improving before they can articulate why — the
 *  sample rate, the bit depth, the stereo field and the reverb are all
 *  diegetic read-outs of Pxd / Vtx / Lx / Aq.
 *
 *    S1  4-bit square footsteps · 8 kHz mono · one-pole drone
 *    S2  22 kHz stereo · 3-variant material foley · wind bed
 *    S3  convolution reverb, tail length driven by chunk occupancy
 *    S4  underwater low-pass bus · close-mic rain on the helmet
 *    S5  granular biome ambience built from the biome's own cartridges
 *    S6  adaptive harmonic score that swells with dFi/dt
 *
 *  The ONLY browser API used is Web Audio. No DOM, no assets, no network.
 * ==========================================================================*/

import type { FidelityState, MetricKey } from "./contracts.setmix";
import { fidelityIndex, normalised, stageOf } from "./fidelity";

export type Surface = "dust" | "crystal" | "metal" | "grass" | "water";

export interface AudioConfig {
  masterGain?: number;
  /** deterministic — the same seed gives the same grain sequence */
  seed?: number;
}

export interface AudioTelemetry {
  stage: number;
  sampleRate: number;
  bitDepth: number;
  stereoWidth: number;
  reverbSeconds: number;
  voices: number;
  dFi: number;
  busChain: string[];
}

/* ───────────────────────────────── deterministic RNG (no Math.random) ── */

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/* ═══════════════════════════════════════════════════════════ ENGINE ══ */

export class SetmixAudio {
  readonly ctx: AudioContext;

  /* ── the bus chain, built once and only re-tuned thereafter ───────── */
  private master!: GainNode;
  private limiter!: DynamicsCompressorNode;
  /** the bit-crusher: a WaveShaper quantising to 2^bits levels */
  private crusher!: WaveShaperNode;
  /** sample-rate reduction, faked honestly with a steep low-pass */
  private srLimit!: BiquadFilterNode;
  /** S4 underwater bus */
  private underwater!: BiquadFilterNode;
  private widener!: StereoPannerNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private convolver!: ConvolverNode;

  /* ── persistent voices ───────────────────────────────────────────── */
  private drone?: { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode };
  private wind?: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode; lfo: OscillatorNode };
  private rain?: { src: AudioBufferSourceNode; gain: GainNode; hp: BiquadFilterNode };
  private score?: { voices: { osc: OscillatorNode; gain: GainNode }[]; bus: GainNode };
  private granularTimer: number | null = null;

  private rng: () => number;
  private noiseBuf?: AudioBuffer;
  private irCacheSeconds = -1;
  private lastFi = 0;
  private dFi = 0;
  private state: FidelityState = { pxd: 1, vtx: 1, lx: 1, aq: 0, tick: 0 };
  private started = false;
  private voiceCount = 0;

  constructor(cfg: AudioConfig = {}) {
    const Ctor: typeof AudioContext =
      (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.rng = makeRng(cfg.seed ?? 1337);
    this.buildBus(cfg.masterGain ?? 0.5);
  }

  /* ───────────────────────────────────────────────── bus construction ── */

  private buildBus(gain: number) {
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = gain;

    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;

    this.crusher = c.createWaveShaper();
    this.crusher.curve = this.quantCurve(4);   // S1 default: 4-bit
    this.crusher.oversample = "none";

    this.srLimit = c.createBiquadFilter();
    this.srLimit.type = "lowpass";
    this.srLimit.frequency.value = 4000;       // 8 kHz "sample rate" → Nyquist 4k
    this.srLimit.Q.value = 0.9;

    this.underwater = c.createBiquadFilter();
    this.underwater.type = "lowpass";
    this.underwater.frequency.value = 20000;
    this.underwater.Q.value = 0.7;

    this.widener = c.createStereoPanner();
    this.widener.pan.value = 0;

    this.convolver = c.createConvolver();
    this.dry = c.createGain();
    this.wet = c.createGain();
    this.dry.gain.value = 1;
    this.wet.gain.value = 0;

    //   voices → crusher → srLimit → underwater ─┬→ dry ─┬→ widener → limiter → master → out
    //                                            └→ wet → convolver ┘
    this.crusher.connect(this.srLimit);
    this.srLimit.connect(this.underwater);
    this.underwater.connect(this.dry);
    this.underwater.connect(this.wet);
    this.wet.connect(this.convolver);
    this.dry.connect(this.widener);
    this.convolver.connect(this.widener);
    this.widener.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(c.destination);

    this.setReverbSeconds(0.0001);
  }

  /** WaveShaper curve that rounds its input to 2^bits levels. This is a real
   *  bit-crusher, not an emulation — the quantisation error is the sound. */
  private quantCurve(bits: number): Float32Array<ArrayBuffer> {
    const n = 4096;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    const levels = Math.pow(2, Math.max(1, bits));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * levels * 0.5) / (levels * 0.5);
    }
    return curve;
  }

  private noise(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * 2.5);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = this.rng() * 2 - 1;
        // light pinking — pure white noise reads as hiss, not as wind
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57555 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      }
    }
    this.noiseBuf = buf;
    return buf;
  }

  /** Procedural impulse response: exponentially-decaying noise with an early
   *  reflection cluster. Tail length comes from chunk occupancy, so a canyon
   *  genuinely sounds like a canyon without anyone recording one. */
  private setReverbSeconds(seconds: number, occupancy = 0.5) {
    const s = Math.max(0.0001, seconds);
    if (Math.abs(s - this.irCacheSeconds) < 0.05) return;
    this.irCacheSeconds = s;
    const c = this.ctx;
    const len = Math.max(32, Math.floor(c.sampleRate * s));
    const ir = c.createBuffer(2, len, c.sampleRate);
    const rng = makeRng(0xca75);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (rng() * 2 - 1) * Math.pow(1 - t, 2.4 + occupancy * 2.2);
      }
      // early reflections — spacing is the "room size"
      const nRefl = 4 + Math.floor(occupancy * 6);
      for (let r = 1; r <= nRefl; r++) {
        const idx = Math.floor((len * r) / (nRefl * 7));
        if (idx < len) d[idx] += (rng() * 2 - 1) * 0.55 * Math.pow(0.72, r);
      }
    }
    this.convolver.buffer = ir;
  }

  /* ─────────────────────────────────────────────────── public control ── */

  async start() {
    if (this.started) return;
    await this.ctx.resume();
    this.started = true;
    this.startDrone();
    this.startWind();
    this.startScore();
    this.update(this.state, 0);
  }

  async stop() {
    this.started = false;
    if (this.granularTimer !== null) {
      clearInterval(this.granularTimer);
      this.granularTimer = null;
    }
    this.drone?.osc.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    this.wind?.src.stop();
    this.wind?.lfo.stop();
    this.rain?.src.stop();
    this.score?.voices.forEach((v) => { try { v.osc.stop(); } catch { /* idem */ } });
    this.drone = this.wind = this.rain = this.score = undefined;
    await this.ctx.suspend();
  }

  setMasterGain(g: number) {
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, g)), this.ctx.currentTime, 0.05);
  }

  /* ════════════════════════════════════════════ THE FIDELITY BINDING ══ */

  /**
   *  Call every frame (or every sim tick). Everything below is a smooth
   *  parameter ramp — there are no discrete "switch to stage N" events,
   *  because an audible click at a stage boundary would undo the whole point.
   */
  update(s: FidelityState, dtSeconds: number): AudioTelemetry {
    this.state = s;
    const n = normalised(s);
    const fi = fidelityIndex(s);
    const stage = stageOf(fi);
    const t = this.ctx.currentTime;

    if (dtSeconds > 0) {
      this.dFi = this.dFi * 0.9 + ((fi - this.lastFi) / Math.max(1e-3, dtSeconds)) * 0.1;
      this.lastFi = fi;
    }

    /* ── Pxd → bit depth + sample rate.  4-bit/8 kHz → 24-bit/48 kHz ──── */
    const bits = 4 + n.pxd * 12;
    const wantBits = Math.round(bits);
    if (wantBits !== this.currentBits) {
      this.crusher.curve = this.quantCurve(wantBits);
      this.currentBits = wantBits;
    }
    const nyquist = 4000 * Math.pow(6, n.pxd);           // 4 kHz → 24 kHz
    this.srLimit.frequency.setTargetAtTime(Math.min(nyquist, 22000), t, 0.3);

    /* ── Vtx → stereo width.  S1 is mono because a 48-triangle world has
     *     no spatial information worth encoding. Width is geometry. ───── */
    const width = Math.min(1, n.vtx * 1.3);
    this.widener.pan.setTargetAtTime(0, t, 0.3);
    if (this.wind) this.wind.gain.gain.setTargetAtTime(0.02 + width * 0.1, t, 0.6);

    /* ── Lx → reverb.  Light transport and sound transport are the same
     *     problem; we tie the tail to Lx and the colour to occupancy. ─── */
    const occupancy = 0.35 + n.vtx * 0.5;
    const tail = 0.08 + Math.pow(n.lx, 1.3) * 3.4;
    this.setReverbSeconds(tail, occupancy);
    this.wet.gain.setTargetAtTime(Math.min(0.42, n.lx * 0.5), t, 0.5);
    this.dry.gain.setTargetAtTime(1 - Math.min(0.3, n.lx * 0.3), t, 0.5);

    /* ── Aq → underwater bus + rain ──────────────────────────────────── */
    const submerged = Math.max(0, (n.aq - 0.55) * 2.2);
    this.underwater.frequency.setTargetAtTime(
      20000 - submerged * 19200, t, 0.25);
    if (n.aq > 0.5 && !this.rain) this.startRain();
    if (this.rain) this.rain.gain.gain.setTargetAtTime(Math.max(0, (n.aq - 0.5) * 0.5), t, 1.2);

    /* ── drone: pitch and harmonics track Lx + Vtx ───────────────────── */
    if (this.drone) {
      const root = 48 + n.lx * 14;
      this.drone.osc.forEach((o, i) => {
        o.frequency.setTargetAtTime(root * (i + 1), t, 1.4);
        o.type = n.pxd < 0.25 ? "square" : n.pxd < 0.6 ? "triangle" : "sine";
      });
      this.drone.filter.frequency.setTargetAtTime(180 + n.lx * 2600, t, 1.0);
      this.drone.gain.gain.setTargetAtTime(0.11 - n.aq * 0.05, t, 1.0);
    }

    /* ── S5 granular biome ambience ──────────────────────────────────── */
    if (n.vtx > 0.42 && this.granularTimer === null) this.startGranular();
    if (n.vtx <= 0.35 && this.granularTimer !== null) {
      clearInterval(this.granularTimer);
      this.granularTimer = null;
    }

    /* ── S6 adaptive score: swells with dFi/dt, not with Fi ──────────── *
     *  The music rewards IMPROVING the planet, not having improved it.
     *  Reaching Stage 6 and idling is quiet; a Render Pass is a crescendo. */
    if (this.score) {
      const drive = Math.min(1, Math.abs(this.dFi) / 2200);
      const unlock = Math.max(0, (n.lx - 0.5) * 2);
      const bus = Math.min(0.26, unlock * (0.05 + drive * 0.3));
      this.score.bus.gain.setTargetAtTime(bus, t, 1.8);
      const root = 110 * Math.pow(2, Math.floor(n.aq * 2) / 12);
      const ratios = [1, 1.5, 2, 2.5, 3, 4];
      this.score.voices.forEach((v, i) => {
        v.osc.frequency.setTargetAtTime(root * ratios[i % ratios.length], t, 2.4);
        v.gain.gain.setTargetAtTime((i < 2 + unlock * 4 ? 0.2 : 0) / (i + 1), t, 2.4);
      });
    }

    return this.telemetry(stage, wantBits, width, tail);
  }

  private currentBits = 4;

  private telemetry(stage: number, bits: number, width: number, tail: number): AudioTelemetry {
    const n = normalised(this.state);
    const chain = ["voices", `crush ${bits}b`, `lp ${(this.srLimit.frequency.value / 1000).toFixed(1)}k`];
    if (n.aq > 0.55) chain.push("underwater");
    if (n.lx > 0.1) chain.push(`conv ${tail.toFixed(1)}s`);
    chain.push("limiter", "master");
    return {
      stage,
      sampleRate: Math.round(this.srLimit.frequency.value * 2),
      bitDepth: bits,
      stereoWidth: width,
      reverbSeconds: tail,
      voices: this.voiceCount,
      dFi: this.dFi,
      busChain: chain,
    };
  }

  /* ═════════════════════════════════════════════════ persistent voices ══ */

  private startDrone() {
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.value = 0.0;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    const osc: OscillatorNode[] = [];
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = 48 * (i + 1);
      const g = c.createGain();
      g.gain.value = 0.5 / (i + 1);
      o.connect(g).connect(filter);
      o.start();
      osc.push(o);
    }
    filter.connect(gain).connect(this.crusher);
    gain.gain.setTargetAtTime(0.1, c.currentTime, 2.0);
    this.drone = { osc, gain, filter };
    this.voiceCount += 3;
  }

  private startWind() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 480;
    filter.Q.value = 0.6;
    const gain = c.createGain();
    gain.gain.value = 0.0;
    // slow LFO on the band centre = gusting, for free
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    src.connect(filter).connect(gain).connect(this.crusher);
    src.start();
    this.wind = { src, gain, filter, lfo };
    this.voiceCount += 1;
  }

  private startRain() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    src.playbackRate.value = 1.7;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const gain = c.createGain();
    gain.gain.value = 0;
    // rain bypasses the crusher: it is a CLOSE-MIC layer on the helmet, so
    // it stays clean even when the world is being rendered at 4 bits.
    src.connect(hp).connect(gain).connect(this.underwater);
    src.start();
    this.rain = { src, gain, hp };
    this.voiceCount += 1;
  }

  private startScore() {
    const c = this.ctx;
    const bus = c.createGain();
    bus.gain.value = 0;
    const voices = Array.from({ length: 6 }, (_, i) => {
      const osc = c.createOscillator();
      osc.type = i % 2 ? "triangle" : "sine";
      osc.frequency.value = 110 * (i + 1);
      osc.detune.value = (this.rng() - 0.5) * 9;
      const gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(bus);
      osc.start();
      return { osc, gain };
    });
    // the score sits AFTER the crusher: it is non-diegetic, so it is never
    // degraded by the planet's render fidelity. Only its volume responds.
    bus.connect(this.underwater);
    this.score = { voices, bus };
    this.voiceCount += 6;
  }

  /** S5 granular ambience. Grains are short filtered noise bursts whose
   *  density, pitch and pan are seeded from the biome's dominant metric —
   *  a grass cartridge literally carries its own grain of insect chirp. */
  private startGranular() {
    this.granularTimer = setInterval(() => {
      if (!this.started) return;
      const n = normalised(this.state);
      const density = Math.floor(1 + n.vtx * 3);
      for (let i = 0; i < density; i++) this.grain(n);
    }, 180) as unknown as number;
  }

  private grain(n: Record<MetricKey, number>) {
    const c = this.ctx;
    const t = c.currentTime + this.rng() * 0.14;
    const src = c.createBufferSource();
    src.buffer = this.noise();
    src.playbackRate.value = 0.4 + this.rng() * (0.6 + n.pxd * 2.4);
    const off = this.rng() * 2;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 600 + this.rng() * (900 + n.lx * 4200);
    bp.Q.value = 6 + this.rng() * 14;
    const g = c.createGain();
    const pan = c.createStereoPanner();
    pan.pan.value = (this.rng() * 2 - 1) * Math.min(1, n.vtx * 1.2);
    const dur = 0.06 + this.rng() * 0.22;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035 * n.vtx, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(pan).connect(this.underwater);
    src.start(t, off, dur);
    src.stop(t + dur + 0.02);
  }

  /* ═══════════════════════════════════════════════════════════ FOLEY ══ */

  /**
   *  One footstep. At S1 this is a 4-bit square blip; by S5 it is a
   *  three-layer material-aware impact with a wetness parameter. Same
   *  function, same call site — only the FidelityState differs.
   */
  footstep(surface: Surface = "dust") {
    if (!this.started) return;
    const c = this.ctx;
    const n = normalised(this.state);
    const t = c.currentTime + 0.001;

    const TUNE: Record<Surface, { f: number; q: number; dur: number; tone: number }> = {
      dust:    { f: 220,  q: 1.2, dur: 0.11, tone: 0.1 },
      crystal: { f: 1850, q: 9.0, dur: 0.22, tone: 0.8 },
      metal:   { f: 900,  q: 6.0, dur: 0.30, tone: 0.65 },
      grass:   { f: 420,  q: 2.0, dur: 0.14, tone: 0.2 },
      water:   { f: 700,  q: 1.6, dur: 0.20, tone: 0.3 },
    };
    const k = TUNE[surface];
    // S2+ picks one of three variants; S1 has exactly one sample, like 1983.
    const variant = n.pxd > 0.12 ? Math.floor(this.rng() * 3) : 0;
    const detune = 1 + (variant - 1) * 0.11 * Math.min(1, n.pxd * 2);

    // noise body
    const src = c.createBufferSource();
    src.buffer = this.noise();
    src.playbackRate.value = 0.8 + this.rng() * 0.5;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = k.f * detune;
    bp.Q.value = k.q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + k.dur * (1 + n.lx * 0.6));
    src.connect(bp).connect(g).connect(this.crusher);
    src.start(t, this.rng() * 2, k.dur + 0.1);

    // tonal component — the part that makes crystal sound like crystal
    if (k.tone > 0.05) {
      const o = c.createOscillator();
      o.type = n.pxd < 0.2 ? "square" : "triangle";
      o.frequency.setValueAtTime(k.f * 2 * detune, t);
      o.frequency.exponentialRampToValueAtTime(k.f * 1.2 * detune, t + k.dur);
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.22 * k.tone, t + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0001, t + k.dur * 1.4);
      o.connect(og).connect(this.crusher);
      o.start(t);
      o.stop(t + k.dur * 1.6);
    }

    // S4+ wetness layer: a short bright splash that only exists once Aq does
    if (n.aq > 0.3) {
      const w = c.createBufferSource();
      w.buffer = this.noise();
      w.playbackRate.value = 2.4;
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2600;
      const wg = c.createGain();
      wg.gain.setValueAtTime(0.0001, t);
      wg.gain.exponentialRampToValueAtTime(0.16 * n.aq, t + 0.006);
      wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      w.connect(hp).connect(wg).connect(this.underwater);
      w.start(t, this.rng() * 2, 0.18);
    }
  }

  /** The stage-transition chord: the 2.5-second stop-the-world moment. */
  fidelityChime(stage: number) {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime + 0.02;
    const root = 196 * Math.pow(2, (stage - 1) / 12);
    const ratios = [1, 1.25, 1.5, 2];
    ratios.forEach((r, i) => {
      const o = c.createOscillator();
      o.type = stage < 3 ? "square" : "sine";
      o.frequency.value = root * r;
      const g = c.createGain();
      const start = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.16 / (i + 1), start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 2.4);
      o.connect(g).connect(stage < 3 ? this.crusher : this.underwater);
      o.start(start);
      o.stop(start + 2.6);
    });
  }

  /** The anti-pop whoosh: fired TWO FRAMES BEFORE the geometry changes.
   *  Sound arriving marginally early makes the eye attribute the visual
   *  change to the sound — the cheapest frame budget in the industry. */
  bandWhoosh(intensity = 1) {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise();
    src.playbackRate.value = 0.6;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(220, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * intensity, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    src.connect(bp).connect(g).connect(this.underwater);
    src.start(t, 0, 0.4);
  }
}

/* ───────────────────────────────────────────────── stage descriptions ── */

export const AUDIO_STAGES = [
  { stage: 1, sr: "8 kHz mono", bits: "4-bit", detail: "Square-wave footsteps, one-pole drone, no reverb, no occlusion. One footstep sample, like 1983." },
  { stage: 2, sr: "22 kHz stereo", bits: "7-bit", detail: "Three material-aware foley variants, pinked wind bed with a 0.07 Hz gust LFO. Stereo arrives with Vtx — width is geometry." },
  { stage: 3, sr: "32 kHz", bits: "12-bit", detail: "Procedural convolution reverb; tail length from Lx, early-reflection spacing from chunk occupancy. Canyons echo because they are canyons." },
  { stage: 4, sr: "44 kHz", bits: "16-bit", detail: "Underwater low-pass bus at 800 Hz, plus close-mic rain that bypasses the crusher — the helmet is not low-fidelity." },
  { stage: 5, sr: "48 kHz", bits: "20-bit", detail: "Granular biome ambience: 1–4 grains per 180 ms, pitch and pan seeded from the biome's own cartridges." },
  { stage: 6, sr: "48 kHz", bits: "24-bit", detail: "Six-voice harmonic score keyed to dFi/dt — the music rewards improving the planet, not having improved it." },
] as const;
