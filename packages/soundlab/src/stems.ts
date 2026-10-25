/**
 * @hm/soundlab/stems: recursive synth patches, and the Fidelity Stage's own audio ladder (plan 43, step 4).
 *
 * A stem is a small tree of **patches**, each of which is oscillators through envelopes and filters, summed into one voice:
 *
 *   oscillator -> envelope -> filter -> patch -> stem -> the stage's mix
 *
 * That is the same recursion the art uses (`part` -> sub-assembly -> kit): a chevron lock is nine ticks of the same atom with
 * rising delays, an engine hum is two detuned atoms under one filter, a music track is four stems under one song.
 *
 * What a stage can *play* is a property of its hardware, and it is not negotiable: at S0 the machine has a one-bit PC speaker
 * with one square channel, so a sawtooth becomes a square, noise becomes a square, and a stereo pan means nothing. At S4 the
 * same stem is 16-bit, 48 kHz, stereo and placed in the world. `stageSoundsLike` performs that reduction, and `renderStem`
 * renders it, so a stem sounds like the era it is played in rather than like the patch it was written as.
 *
 * Pure: no clock, no `Math.random` (the noise atoms use a seeded generator), no DOM.
 */
import { mulberry32 } from './render';
import type { SfxFilter, Wave } from './recipe';

/** What a stem is for, which decides how loud it may be and where it sits in the mix. */
export type StemRole = 'machine' | 'rifle' | 'gate' | 'music';

export const STEM_ROLES: readonly StemRole[] = Object.freeze(['machine', 'rifle', 'gate', 'music'] as const);

/** One oscillator through an envelope: the atom everything else is built from. */
export interface OscAtom {
  readonly wave: Wave;
  readonly freqHz: number;
  /** Cents: the second atom of an engine hum is detuned from the first. */
  readonly detuneCents?: number;
  readonly gain: number;
  readonly attackMs: number;
  readonly decayMs: number;
  readonly delayMs?: number;
  readonly filter?: SfxFilter;
}

/** A patch: atoms summed, with child patches summed under it (a chevron tick is an atom; nine ticks are a patch). */
export interface PatchNode {
  readonly name: string;
  readonly gain?: number;
  readonly atoms?: readonly OscAtom[];
  readonly children?: readonly PatchNode[];
}

/** A stem preset: the rung that the game actually starts, stops and places. */
export interface StemPreset {
  readonly id: string;
  readonly name: string;
  readonly role: StemRole;
  readonly patch: PatchNode;
  readonly gain: number;
  /** -1 (left) to 1 (right). Only stages with spatial audio use it. */
  readonly pan?: number;
  /** Metres from the listener, which a spatial stage turns into distance and a monophonic one does not. */
  readonly distanceM?: number;
  /** A looping stem (a hum, a music bed): one cycle's length in seconds. A one-shot has none. */
  readonly loopSeconds?: number;
}

/* ------------------------------------------------------------------ the ladder */

/** A stage's audio hardware, in its own era's words. */
export interface AudioStage {
  readonly stage: number;
  readonly name: string;
  readonly sampleRateHz: number;
  readonly bitDepth: number;
  readonly channels: 1 | 2;
  /** The waveforms the hardware can make. Anything else is reduced to one of these. */
  readonly waves: readonly Wave[];
  readonly noise: boolean;
  readonly filters: boolean;
  /** True when the mix places a source in the world (pan and distance). */
  readonly spatial: boolean;
  readonly maxVoices: number;
  /** The loudest a single voice may be at this stage (a PC speaker's square is loud; a modern mix leaves headroom). */
  readonly headroom: number;
}

/**
 * The ladder: PC speaker (S0), FM chip (S1-S2), sampled console (S3), and the full spatial mix (S4-S6). Every number rises
 * with the stage, which is the point: a stem written once is heard as its era's hardware can hear it.
 */
export const AUDIO_STAGE_LADDER: readonly AudioStage[] = Object.freeze([
  { stage: 0, name: 'PC speaker (1-bit)', sampleRateHz: 11025, bitDepth: 1, channels: 1, waves: ['square'], noise: false, filters: false, spatial: false, maxVoices: 1, headroom: 0.5 },
  { stage: 1, name: 'FM chip (EGA)', sampleRateHz: 22050, bitDepth: 8, channels: 1, waves: ['square', 'sine', 'triangle'], noise: false, filters: false, spatial: false, maxVoices: 3, headroom: 0.6 },
  { stage: 2, name: 'FM chip + noise (VGA)', sampleRateHz: 22050, bitDepth: 8, channels: 1, waves: ['square', 'sine', 'triangle', 'sawtooth'], noise: true, filters: false, spatial: false, maxVoices: 4, headroom: 0.7 },
  { stage: 3, name: 'Sampled console (Gouraud)', sampleRateHz: 32000, bitDepth: 12, channels: 2, waves: ['square', 'sine', 'triangle', 'sawtooth'], noise: true, filters: true, spatial: false, maxVoices: 8, headroom: 0.8 },
  { stage: 4, name: 'Spatial mix (PBR)', sampleRateHz: 48000, bitDepth: 16, channels: 2, waves: ['square', 'sine', 'triangle', 'sawtooth'], noise: true, filters: true, spatial: true, maxVoices: 16, headroom: 0.9 },
  { stage: 5, name: 'Spatial mix (PBR+)', sampleRateHz: 48000, bitDepth: 16, channels: 2, waves: ['square', 'sine', 'triangle', 'sawtooth'], noise: true, filters: true, spatial: true, maxVoices: 24, headroom: 0.9 },
  { stage: 6, name: 'Spatial mix (full)', sampleRateHz: 48000, bitDepth: 16, channels: 2, waves: ['square', 'sine', 'triangle', 'sawtooth'], noise: true, filters: true, spatial: true, maxVoices: 32, headroom: 0.95 },
] as const);

/** The hardware a stage plays on. Pure; a stage off the ladder is clamped, never undefined. */
export function audioStageFor(stage: number): AudioStage {
  const s = Number.isFinite(stage) ? Math.max(0, Math.min(6, Math.floor(stage))) : 0;
  return AUDIO_STAGE_LADDER[s] as AudioStage;
}

/* ------------------------------------------------------- what a stage can play */

/** How a waveform is reduced when the hardware cannot make it: the nearest thing it *can* make. */
export function reduceWave(wave: Wave, hw: AudioStage): Wave {
  if ((hw.waves as readonly string[]).includes(wave)) return wave;
  // noise is a generator, not a waveform: the hardware either has one or does not
  if (wave === 'noise') return hw.noise ? 'noise' : 'square';
  // a saw and a triangle both lose their overtones to a square; a square never loses anything
  if ((hw.waves as readonly string[]).includes('square')) return 'square';
  return hw.waves[0] ?? 'square';
}

/** One atom as the hardware can play it: the wave reduced, the filter dropped when there is none. Pure. */
export function reduceAtom(atom: OscAtom, hw: AudioStage): OscAtom {
  // the old filter has to be *removed* from the spread, not merely left out of it
  const { filter, ...rest } = atom;
  return { ...rest, wave: reduceWave(atom.wave, hw), ...(hw.filters && filter ? { filter } : {}) };
}

/** A patch as the hardware can play it (children first, gains kept). Pure, and safe on a malformed patch. */
export function reducePatch(patch: PatchNode, hw: AudioStage): PatchNode {
  return {
    name: patch.name,
    ...(patch.gain !== undefined ? { gain: patch.gain } : {}),
    ...(patch.atoms ? { atoms: patch.atoms.map((a) => reduceAtom(a, hw)) } : {}),
    ...(patch.children ? { children: patch.children.map((c) => reducePatch(c, hw)) } : {}),
  };
}

/**
 * The stem as a stage hears it: the patch reduced to the hardware, the loudness bounded by the stage's headroom, the pan
 * dropped where there is no stereo to put it in, and only the first `maxVoices` atoms kept (a PC speaker plays one note).
 */
export function stageSoundsLike(stem: StemPreset, stage: number): StemPreset {
  const hw = audioStageFor(stage);
  const reduced = reducePatch(stem.patch, hw);
  const voices = countAtoms(reduced);
  const limited = voices > hw.maxVoices ? limitVoices(reduced, hw.maxVoices) : reduced;
  const gain = Math.min(stem.gain, hw.headroom);
  return {
    id: stem.id,
    name: `${stem.name} (${hw.name})`,
    role: stem.role,
    patch: limited,
    gain,
    ...(hw.spatial && stem.pan !== undefined ? { pan: Math.max(-1, Math.min(1, stem.pan)) } : {}),
    ...(hw.spatial && stem.distanceM !== undefined ? { distanceM: Math.max(0, stem.distanceM) } : {}),
    ...(stem.loopSeconds !== undefined ? { loopSeconds: stem.loopSeconds } : {}),
  };
}

/** How many oscillator atoms a patch holds. */
export function countAtoms(patch: PatchNode): number {
  let n = patch.atoms?.length ?? 0;
  for (const c of patch.children ?? []) n += countAtoms(c);
  return n;
}

/** A patch cut down to its first `max` atoms in tree order (what a hardware voice limit does). */
function limitVoices(patch: PatchNode, max: number): PatchNode {
  const budget = { left: max };
  const walk = (node: PatchNode): PatchNode | null => {
    const atoms: OscAtom[] = [];
    for (const a of node.atoms ?? []) {
      if (budget.left <= 0) break;
      atoms.push(a);
      budget.left -= 1;
    }
    const children: PatchNode[] = [];
    for (const c of node.children ?? []) {
      if (budget.left <= 0) break;
      const kept = walk(c);
      if (kept) children.push(kept);
    }
    if (atoms.length === 0 && children.length === 0) return null;
    return {
      name: node.name,
      ...(node.gain !== undefined ? { gain: node.gain } : {}),
      ...(atoms.length > 0 ? { atoms } : {}),
      ...(children.length > 0 ? { children } : {}),
    };
  };
  return walk(patch) ?? { name: patch.name };
}

/* ------------------------------------------------------------------ rendering */

/** How long one cycle of a stem lasts, in ms: its loop, or its last atom's release. */
export function stemLengthMs(stem: StemPreset): number {
  if (stem.loopSeconds !== undefined && stem.loopSeconds > 0) return Math.round(stem.loopSeconds * 1000);
  let end = 0;
  const walk = (patch: PatchNode): void => {
    for (const a of patch.atoms ?? []) {
      const at = (a.delayMs ?? 0) + a.attackMs + a.decayMs;
      if (at > end) end = at;
    }
    for (const c of patch.children ?? []) walk(c);
  };
  walk(stem.patch);
  return Math.max(1, Math.round(end));
}

const waveAt = (kind: Wave, phase: number, noise: () => number): number => {
  switch (kind) {
    case 'square': return phase < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * phase - 1;
    case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
    case 'noise': return noise() * 2 - 1;
    default: return Math.sin(2 * Math.PI * phase);
  }
};

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** RBJ cookbook coefficients (the same filter the recipe renderer uses). */
function biquad(type: SfxFilter['type'], cutoff: number, q: number, sampleRate: number): Biquad {
  const w = (2 * Math.PI * Math.min(cutoff, sampleRate * 0.45)) / sampleRate;
  const cos = Math.cos(w), alpha = Math.sin(w) / (2 * Math.max(0.0001, q));
  const a0 = 1 + alpha;
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

/**
 * Render one cycle of a stem at a stage's hardware: the patch summed (children under their parent's gain), each atom's own
 * envelope, then the stage's sample rate, its bit depth, its mono/stereo and its placement. Pure: the same stem, stage and
 * seed always give the same samples.
 */
export function renderStem(stem: StemPreset, stage: number, seed = 1): { readonly sampleRateHz: number; readonly channels: readonly Float32Array[]; readonly peak: number } {
  const hw = audioStageFor(stage);
  const heard = stageSoundsLike(stem, stage);
  const lengthMs = stemLengthMs(heard);
  const n = Math.max(1, Math.round((lengthMs / 1000) * hw.sampleRateHz));
  const mono = new Float32Array(n);
  const noise = mulberry32(seed);

  const renderAtoms = (patch: PatchNode, parentGain: number): void => {
    const gain = parentGain * (patch.gain ?? 1);
    for (const atom of patch.atoms ?? []) {
      const startSample = Math.round(((atom.delayMs ?? 0) / 1000) * hw.sampleRateHz);
      const attack = Math.max(1, Math.round((atom.attackMs / 1000) * hw.sampleRateHz));
      const decay = Math.max(1, Math.round((atom.decayMs / 1000) * hw.sampleRateHz));
      const freq = Math.max(1, Math.min(hw.sampleRateHz * 0.45, atom.freqHz * (atom.detuneCents ? 2 ** (atom.detuneCents / 1200) : 1)));
      const phaseStep = freq / hw.sampleRateHz;
      const filter = atom.filter ? biquad(atom.filter.type, atom.filter.freq[0], atom.filter.q, hw.sampleRateHz) : null;
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      let phase = 0;
      for (let i = 0; i < decay; i += 1) {
        const at = startSample + i;
        if (at >= n) break;
        const env = i < attack ? i / attack : Math.exp(-3 * ((i - attack) / decay));
        let sample = waveAt(atom.wave, phase, noise) * env * atom.gain * gain;
        if (filter) {
          const y = filter.b0 * sample + filter.b1 * x1 + filter.b2 * x2 - filter.a1 * y1 - filter.a2 * y2;
          x2 = x1; x1 = sample; y2 = y1; y1 = y;
          sample = y;
        }
        mono[at] = (mono[at] as number) + sample;
        phase += phaseStep;
        if (phase >= 1) phase -= Math.floor(phase);
      }
    }
    for (const child of patch.children ?? []) renderAtoms(child, gain);
  };
  renderAtoms(heard.patch, heard.gain);

  // the mix: place it (or not), then quantise to the hardware's depth
  const pan = hw.spatial ? Math.max(-1, Math.min(1, heard.pan ?? 0)) : 0;
  const distance = hw.spatial ? Math.max(0, heard.distanceM ?? 0) : 0;
  const attenuation = hw.spatial ? 1 / (1 + distance / 8) : 1;
  const leftGain = attenuation * Math.min(1, 1 - pan) ;
  const rightGain = attenuation * Math.min(1, 1 + pan);
  const quantise = (v: number): number => {
    const clamped = Math.max(-1, Math.min(1, v));
    if (hw.bitDepth <= 1) return clamped === 0 ? 0 : clamped > 0 ? 1 : -1;
    const steps = 2 ** (hw.bitDepth - 1);
    return Math.round(clamped * steps) / steps;
  };
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const v = mono[i] as number;
    left[i] = quantise(v * leftGain);
    right[i] = quantise(v * rightGain);
  }
  const channels: readonly Float32Array[] = hw.channels === 1 ? [left] : [left, right];
  let peak = 0;
  for (const ch of channels) for (const v of ch) if (Math.abs(v) > peak) peak = Math.abs(v);
  return { sampleRateHz: hw.sampleRateHz, channels, peak };
}

/** The energy a buffer carries above `cutoff` (a crude high-pass sum of squares), for tests and the Bench's readouts. */
export function brightEnergy(samples: Float32Array, cutoffHz: number, sampleRateHz: number): number {
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRateHz);
  let low = 0, high = 0;
  for (let i = 0; i < samples.length; i += 1) {
    low += a * ((samples[i] as number) - low);
    const h = (samples[i] as number) - low;
    high += h * h;
  }
  return high;
}

/* --------------------------------------------------------------------- shelf */

const atom = (wave: Wave, freqHz: number, gain: number, attackMs: number, decayMs: number, extra: Partial<OscAtom> = {}): OscAtom =>
  ({ wave, freqHz, gain, attackMs, decayMs, ...extra });

const stem = (id: string, name: string, role: StemRole, gain: number, patch: PatchNode, extra: Partial<StemPreset> = {}): StemPreset =>
  Object.freeze({ id, name, role, gain, patch, ...extra });

/** A machine's hum: a fundamental and its octave, detuned, so the pair beats like a motor rather than a test tone. */
const hum = (id: string, name: string, freqHz: number, gain: number, extra: Partial<StemPreset> = {}): StemPreset =>
  stem(id, name, 'machine', gain, {
    name: 'hum',
    atoms: [
      atom('sawtooth', freqHz, 0.5, 40, 200, { filter: { type: 'lowpass', freq: [freqHz * 7, freqHz * 7], q: 1.2 } }),
      atom('sine', freqHz * 2, 0.22, 60, 200, { detuneCents: 9 }),
    ],
  }, { loopSeconds: 0.5, ...extra });

/**
 * The shelf: every stem the game starts, by role (plan 43, step 4's `sndc:` presets). Machine hums are one per kind, the
 * rifle's verbs are its fire, sweep and apply, the gate's are its dial and its chevron lock, and the music bed is four stems
 * the song mixes.
 */
export const STEM_SHELF: Readonly<Record<string, StemPreset>> = Object.freeze({
  // ---- machines: the loop each kind runs while it works (a hum, not an effect)
  'machine-hum-drill': hum('machine-hum-drill', 'Drill hum', 58, 0.22, { pan: 0 }),
  'machine-hum-mill': hum('machine-hum-mill', 'Mill hum', 74, 0.2, { pan: 0.1 }),
  'machine-hum-press': hum('machine-hum-press', 'Press hum', 42, 0.26, { pan: -0.1 }),
  'machine-hum-power': hum('machine-hum-power', 'Power unit hum', 96, 0.18, { pan: 0 }),
  'machine-hum-pylon': hum('machine-hum-pylon', 'Pylon corona', 132, 0.14, { pan: 0 }),
  'machine-hum-projector': hum('machine-hum-projector', 'Projector hum', 88, 0.16, { pan: 0.15 }),
  'machine-hum-water': hum('machine-hum-water', 'Water maker hum', 66, 0.18, { pan: -0.15 }),
  'machine-hum-heavy-mill': hum('machine-hum-heavy-mill', 'Heavy mill hum', 62, 0.24),
  'machine-hum-heavy-press': hum('machine-hum-heavy-press', 'Heavy press hum', 36, 0.28),
  'machine-hum-heavy-projector': hum('machine-hum-heavy-projector', 'Heavy projector hum', 84, 0.18),
  'machine-hum-heavy-water': hum('machine-hum-heavy-water', 'Heavy water maker hum', 58, 0.2),

  // ---- creature vocal-tract resonant formants (plan 44: two-formant bandpass patches per archetype/role)
  'vo-astro': stem('vo-astro', 'Suit comms formant', 'machine', 0.28, {
    name: 'tract',
    atoms: [
      atom('sawtooth', 135, 0.45, 12, 220, { filter: { type: 'bandpass', freq: [520, 520], q: 3.2 } }),
      atom('triangle', 270, 0.25, 18, 200, { detuneCents: 6, filter: { type: 'bandpass', freq: [1480, 1480], q: 2.8 } }),
    ],
  }),
  'vo-theropod': stem('vo-theropod', 'Theropod guttural formant', 'machine', 0.36, {
    name: 'tract',
    atoms: [
      atom('sawtooth', 82, 0.55, 8, 280, { filter: { type: 'bandpass', freq: [360, 360], q: 2.6 } }),
      atom('sawtooth', 164, 0.32, 14, 240, { detuneCents: -11, filter: { type: 'bandpass', freq: [980, 980], q: 3.0 } }),
    ],
  }),
  'vo-quadruped': stem('vo-quadruped', 'Quadruped snarl formant', 'machine', 0.34, {
    name: 'tract',
    atoms: [
      atom('sawtooth', 110, 0.5, 6, 210, { filter: { type: 'bandpass', freq: [440, 440], q: 2.8 } }),
      atom('square', 220, 0.26, 10, 180, { detuneCents: 8, filter: { type: 'bandpass', freq: [1220, 1220], q: 2.5 } }),
    ],
  }),
  'vo-hexapod': stem('vo-hexapod', 'Hexapod stridulation formant', 'machine', 0.3, {
    name: 'tract',
    atoms: [
      atom('square', 240, 0.42, 4, 150, { filter: { type: 'bandpass', freq: [880, 880], q: 4.0 } }),
      atom('triangle', 480, 0.28, 6, 140, { detuneCents: 15, filter: { type: 'bandpass', freq: [2100, 2100], q: 3.5 } }),
    ],
  }),
  'vo-arachnid': stem('vo-arachnid', 'Arachnid mandrel formant', 'machine', 0.32, {
    name: 'tract',
    atoms: [
      atom('sawtooth', 190, 0.45, 5, 170, { filter: { type: 'bandpass', freq: [740, 740], q: 3.8 } }),
      atom('noise', 1, 0.24, 3, 120, { filter: { type: 'bandpass', freq: [1850, 1850], q: 3.2 } }),
    ],
  }),
  'vo-serpentine': stem('vo-serpentine', 'Serpentine sibilant formant', 'machine', 0.3, {
    name: 'tract',
    atoms: [
      atom('noise', 1, 0.45, 10, 260, { filter: { type: 'bandpass', freq: [2400, 2400], q: 4.2 } }),
      atom('triangle', 145, 0.3, 16, 240, { filter: { type: 'bandpass', freq: [580, 580], q: 2.6 } }),
    ],
  }),
  'vo-avian-drone': stem('vo-avian-drone', 'Avian drone formant', 'machine', 0.32, {
    name: 'tract',
    atoms: [
      atom('square', 340, 0.42, 4, 160, { filter: { type: 'bandpass', freq: [1120, 1120], q: 3.6 } }),
      atom('sawtooth', 510, 0.26, 8, 150, { detuneCents: -9, filter: { type: 'bandpass', freq: [2480, 2480], q: 3.0 } }),
    ],
  }),
  'vo-charger': stem('vo-charger', 'Charger bark formant', 'machine', 0.36, {
    name: 'tract',
    atoms: [
      atom('sawtooth', 96, 0.52, 6, 220, { filter: { type: 'bandpass', freq: [410, 410], q: 2.8 } }),
      atom('square', 192, 0.3, 10, 190, { detuneCents: 12, filter: { type: 'bandpass', freq: [1150, 1150], q: 3.1 } }),
    ],
  }),
  'vo-spitter': stem('vo-spitter', 'Spitter rasp formant', 'machine', 0.34, {
    name: 'tract',
    atoms: [
      atom('sawtooth', 155, 0.46, 8, 210, { filter: { type: 'bandpass', freq: [640, 640], q: 3.4 } }),
      atom('noise', 1, 0.28, 4, 160, { filter: { type: 'bandpass', freq: [1920, 1920], q: 3.6 } }),
    ],
  }),
  'vo-swarmer': stem('vo-swarmer', 'Swarmer chitter formant', 'machine', 0.28, {
    name: 'tract',
    atoms: [
      atom('square', 420, 0.4, 3, 110, { filter: { type: 'bandpass', freq: [1350, 1350], q: 4.0 } }),
      atom('triangle', 630, 0.25, 5, 100, { detuneCents: 18, filter: { type: 'bandpass', freq: [2750, 2750], q: 3.4 } }),
    ],
  }),
  'vo-flyer': stem('vo-flyer', 'Flyer resonant drone formant', 'machine', 0.32, {
    name: 'tract',
    atoms: [
      atom('triangle', 210, 0.44, 14, 260, { filter: { type: 'bandpass', freq: [720, 720], q: 3.2 } }),
      atom('sawtooth', 315, 0.28, 18, 240, { detuneCents: -7, filter: { type: 'bandpass', freq: [1640, 1640], q: 2.9 } }),
    ],
  }),
  'vo-brute': stem('vo-brute', 'Brute sub-bellow formant', 'machine', 0.4, {
    name: 'tract',
    atoms: [
      atom('sawtooth', 64, 0.58, 12, 320, { filter: { type: 'bandpass', freq: [280, 280], q: 2.4 } }),
      atom('sawtooth', 128, 0.34, 18, 290, { detuneCents: -14, filter: { type: 'bandpass', freq: [820, 820], q: 2.8 } }),
    ],
  }),
  'vo-sapper': stem('vo-sapper', 'Sapper arc-pulse formant', 'machine', 0.32, {
    name: 'tract',
    atoms: [
      atom('square', 280, 0.44, 5, 180, { filter: { type: 'bandpass', freq: [940, 940], q: 3.8 } }),
      atom('sawtooth', 560, 0.26, 8, 160, { detuneCents: 11, filter: { type: 'bandpass', freq: [2240, 2240], q: 3.5 } }),
    ],
  }),

  // ---- the rifle's verbs (plan 43's `sfx:` voices, one patch each)
  'rifle-beam-fire': stem('rifle-beam-fire', 'Beam fire', 'rifle', 0.5, {
    name: 'verb',
    atoms: [
      atom('sawtooth', 880, 0.5, 3, 140, { filter: { type: 'lowpass', freq: [4200, 4200], q: 3 } }),
      atom('noise', 1, 0.3, 1, 90),
      atom('sine', 180, 0.4, 2, 180),
    ],
  }),
  'rifle-beam-sweep': stem('rifle-beam-sweep', 'Beam sweep', 'rifle', 0.42, {
    name: 'verb',
    atoms: [
      atom('triangle', 320, 0.4, 20, 260, { filter: { type: 'bandpass', freq: [1200, 1200], q: 1.6 } }),
      atom('sine', 640, 0.18, 30, 280, { detuneCents: -14 }),
    ],
  }),
  'rifle-beam-apply': stem('rifle-beam-apply', 'Beam apply', 'rifle', 0.38, {
    name: 'verb',
    atoms: [
      atom('square', 220, 0.35, 4, 120, { filter: { type: 'lowpass', freq: [1800, 1800], q: 2 } }),
      atom('sine', 440, 0.25, 8, 200),
    ],
  }),

  // ---- the gate: nine chevrons locking, each tick a step of the same atom, then the ring's spool
  'gate-chevron-lock': stem('gate-chevron-lock', 'Chevron lock', 'gate', 0.5, {
    name: 'lock',
    gain: 0.9,
    children: Array.from({ length: 9 }, (_, i) => ({
      name: `chevron-${i + 1}`,
      atoms: [atom('square', 300 + i * 45, 0.3, 2, 90, { delayMs: i * 150, filter: { type: 'lowpass', freq: [2600, 2600], q: 1.4 } })],
    })),
  }),
  'gate-dial': stem('gate-dial', 'Gate dial', 'gate', 0.34, {
    name: 'dial',
    atoms: [
      atom('triangle', 520, 0.3, 12, 220),
      atom('square', 780, 0.2, 6, 160, { delayMs: 80 }),
    ],
  }),

  // ---- the music bed, four stems the song mixes (loopSeconds is the bar)
  'music-drums': stem('music-drums', 'Drums', 'music', 0.32, {
    name: 'drums',
    atoms: [atom('noise', 1, 0.5, 1, 120), atom('sine', 70, 0.5, 2, 160, { delayMs: 250 })],
  }, { loopSeconds: 1 }),
  'music-bass': stem('music-bass', 'Bass', 'music', 0.3, {
    name: 'bass',
    atoms: [atom('square', 110, 0.5, 8, 420, { filter: { type: 'lowpass', freq: [700, 700], q: 1 } })],
  }, { loopSeconds: 1 }),
  'music-chords': stem('music-chords', 'Chords', 'music', 0.22, {
    name: 'chords',
    atoms: [atom('triangle', 330, 0.35, 30, 460), atom('triangle', 415, 0.28, 34, 460, { detuneCents: 4 })],
  }, { loopSeconds: 1 }),
  'music-lead': stem('music-lead', 'Lead', 'music', 0.24, {
    name: 'lead',
    atoms: [atom('square', 660, 0.3, 6, 300, { filter: { type: 'lowpass', freq: [3200, 3200], q: 1.4 } })],
  }, { loopSeconds: 1 }),
});

/** A shelf stem by id (null when the id is not on the shelf). */
export function resolveStem(id: string): StemPreset | null {
  return STEM_SHELF[id] ?? null;
}

/** The hum a machine kind runs, by the kind name `@hm/plotsim` uses. */
export function machineHumId(kind: string): string {
  return `machine-hum-${kind}`;
}

/** Every stem of a role, in shelf order. */
export function stemsOfRole(role: StemRole): readonly StemPreset[] {
  return Object.values(STEM_SHELF).filter((s) => s.role === role);
}

/** What is wrong with a stem, in words (an empty list is a playable stem). */
export function validateStem(stem: unknown): string[] {
  const errors: string[] = [];
  const s = stem as Partial<StemPreset> | null;
  if (!s || typeof s !== 'object') return ['A stem must be an object.'];
  if (typeof s.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(s.id)) errors.push('id must be a lowercase slug');
  if (typeof s.name !== 'string' || s.name.trim() === '') errors.push('name must not be empty');
  if (!STEM_ROLES.includes(s.role as StemRole)) errors.push(`role must be one of ${STEM_ROLES.join(', ')}`);
  if (typeof s.gain !== 'number' || !Number.isFinite(s.gain) || s.gain < 0 || s.gain > 2) errors.push('gain must be 0 to 2');
  if (s.pan !== undefined && (!Number.isFinite(s.pan) || Math.abs(s.pan) > 1)) errors.push('pan must be -1 to 1');
  if (s.distanceM !== undefined && (!Number.isFinite(s.distanceM) || s.distanceM < 0)) errors.push('distanceM must be 0 or more');
  if (s.loopSeconds !== undefined && (!Number.isFinite(s.loopSeconds) || s.loopSeconds <= 0)) errors.push('loopSeconds must be positive');
  const walk = (node: PatchNode | undefined, at: string): void => {
    if (!node) { errors.push(`${at} must be a patch`); return; }
    if (typeof node.name !== 'string' || node.name === '') errors.push(`${at} needs a name`);
    for (const a of node.atoms ?? []) {
      if (!Number.isFinite(a.freqHz) || a.freqHz <= 0) errors.push(`${at}: an atom needs a frequency`);
      if (!Number.isFinite(a.gain) || a.gain < 0) errors.push(`${at}: an atom needs a gain`);
      if (!Number.isFinite(a.attackMs) || a.attackMs < 0) errors.push(`${at}: an atom needs an attack`);
      if (!Number.isFinite(a.decayMs) || a.decayMs <= 0) errors.push(`${at}: an atom needs a decay`);
    }
    for (const c of node.children ?? []) walk(c, `${at}/${c.name}`);
  };
  walk(s.patch as PatchNode, 'patch');
  if (countAtoms(s.patch as PatchNode) === 0) errors.push('a stem needs at least one oscillator');
  return errors;
}
