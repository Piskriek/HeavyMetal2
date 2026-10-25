/**
 * @hm/musicbox/stems: a `Song` turned into the four stems a game actually plays (plan 43, step 4).
 *
 * The harmonic machine writes notes; a stem turns notes into an oscillator patch. Each track is a voice: the drums are noise
 * and low sines, the bass is a filtered square, the chords are a triangle pair, the lead is a square with a little more bite.
 * Every note becomes one atom with its own delay and a decay cut to its written length, so the recursion is
 * `note -> atom -> track patch -> stem -> the stage's mix` and nothing in it holds state between frames.
 *
 * The stage still decides what can be heard: at S0 the whole arrangement collapses to the first note of the first stem, which
 * is exactly what a one-voice PC speaker did to eight bars of music.
 */
import type { Note, Song, Track } from './index';
import { audioStageFor, renderStem, type OscAtom, type SfxFilter, type StemPreset, type Wave } from '@hm/soundlab';

export const TRACKS: readonly Track[] = Object.freeze(['drums', 'bass', 'chords', 'lead'] as const);

/** The voice a track plays with. */
export interface TrackVoice {
  readonly wave: Wave;
  /** Fraction of the note's written length that the voice rings for (0.9 leaves a gap so repeated notes do not smear). */
  readonly gate: number;
  readonly attackMs: number;
  readonly gain: number;
  readonly filter?: SfxFilter;
  /** Where the track sits at a spatial stage: -1 left, 1 right. */
  readonly pan: number;
}

export const TRACK_VOICE: Readonly<Record<Track, TrackVoice>> = Object.freeze({
  drums: { wave: 'noise', gate: 1, attackMs: 1, gain: 0.9, pan: 0 },
  bass: { wave: 'square', gate: 0.85, attackMs: 4, gain: 0.8, filter: { type: 'lowpass', freq: [620, 620], q: 1 }, pan: -0.12 },
  chords: { wave: 'triangle', gate: 0.95, attackMs: 26, gain: 0.5, filter: { type: 'lowpass', freq: [2400, 2400], q: 0.8 }, pan: 0.18 },
  lead: { wave: 'square', gate: 0.8, attackMs: 6, gain: 0.6, filter: { type: 'lowpass', freq: [3200, 3200], q: 1.4 }, pan: 0.32 },
});

/** MIDI pitch to Hz (A4 = 69 = 440 Hz). Pure; a nonsense pitch is clamped to the audible shelf rather than NaN. */
export function pitchToHz(pitch: number): number {
  const p = Number.isFinite(pitch) ? Math.max(0, Math.min(127, pitch)) : 69;
  return 440 * 2 ** ((p - 69) / 12);
}

/** A song's length in seconds: `bars` bars of four beats. */
export function songSeconds(song: Song): number {
  return Math.max(0.001, song.bars * 4 * (60 / Math.max(1, song.bpm)));
}

/** One beat in seconds for this song (the same rule as `beatSeconds`, guarded against a zero tempo). */
const beat = (song: Song): number => 60 / Math.max(1, song.bpm);

/** A note's onset and ring, in milliseconds. */
export function noteTiming(song: Song, note: Note, gate: number): { delayMs: number; decayMs: number } {
  const b = beat(song);
  const delayMs = Math.max(0, note.beat * b * 1000);
  const ring = Math.max(20, note.length * b * gate * 1000); // never shorter than a click, in ms
  return { delayMs, decayMs: ring };
}

/** The percussion voices: a kick is a low sine, a snare is noise with a body, a hat is a short hiss. */
function drumAtoms(note: Note, delayMs: number, decayMs: number): OscAtom[] {
  const velocity = Math.max(0.05, Math.min(1, note.velocity));
  if (note.pitch <= 37) {
    return [
      { wave: 'sine', freqHz: 52, gain: 0.9 * velocity, attackMs: 2, decayMs: Math.max(120, decayMs), delayMs },
      { wave: 'square', freqHz: 104, gain: 0.12 * velocity, attackMs: 1, decayMs: 60, delayMs },
    ];
  }
  if (note.pitch <= 40) {
    return [
      { wave: 'noise', freqHz: 1, gain: 0.5 * velocity, attackMs: 1, decayMs: Math.max(70, decayMs), delayMs, filter: { type: 'bandpass', freq: [1800, 1800], q: 0.9 } },
      { wave: 'triangle', freqHz: 190, gain: 0.22 * velocity, attackMs: 1, decayMs: 90, delayMs },
    ];
  }
  return [
    { wave: 'noise', freqHz: 1, gain: 0.24 * velocity, attackMs: 1, decayMs: Math.max(30, Math.min(60, decayMs)), delayMs, filter: { type: 'highpass', freq: [5200, 5200], q: 0.7 } },
  ];
}

/** The atoms one note makes in a track's voice. */
export function atomsForNote(song: Song, track: Track, note: Note): OscAtom[] {
  const voice = TRACK_VOICE[track];
  const { delayMs, decayMs } = noteTiming(song, note, voice.gate);
  if (track === 'drums') return drumAtoms(note, delayMs, decayMs);
  const velocity = Math.max(0.05, Math.min(1, note.velocity));
  return [
    {
      wave: voice.wave,
      freqHz: pitchToHz(note.pitch),
      gain: voice.gain * velocity,
      attackMs: voice.attackMs,
      decayMs,
      delayMs,
      ...(voice.filter ? { filter: voice.filter } : {}),
    },
  ];
}

/**
 * One track of a song as a stem: every note its own child patch (so the tree reads like the score does), under a track
 * patch that carries the voice's gain and filter. Null when the song has no notes on that track.
 */
export function songStem(song: Song, track: Track): StemPreset | null {
  const notes = song.notes.filter((n) => n.track === track);
  if (notes.length === 0) return null;
  const voice = TRACK_VOICE[track];
  const children = notes.map((note, i) => ({
    name: `${track}-${i + 1}`,
    atoms: atomsForNote(song, track, note),
  }));
  return {
    id: `music-${track}`,
    name: `${song.style} ${track}`,
    role: 'music',
    gain: track === 'drums' ? 0.34 : track === 'bass' ? 0.3 : track === 'chords' ? 0.2 : 0.24,
    pan: voice.pan,
    loopSeconds: Number(songSeconds(song).toFixed(4)),
    patch: { name: track, children },
  };
}

/** Every stem the song plays, in the order the mix stacks them. */
export function songStems(song: Song): StemPreset[] {
  const out: StemPreset[] = [];
  for (const track of TRACKS) {
    const stem = songStem(song, track);
    if (stem) out.push(stem);
  }
  return out;
}

/** How many oscillator atoms a song needs before the stage's voice limit trims it. */
export function songAtomCount(song: Song): number {
  let n = 0;
  for (const stem of songStems(song)) n += countStemAtoms(stem);
  return n;
}

const countStemAtoms = (stem: StemPreset): number => {
  let n = 0;
  const walk = (p: { atoms?: readonly unknown[]; children?: readonly unknown[] }): void => {
    n += p.atoms?.length ?? 0;
    for (const c of p.children ?? []) walk(c as { atoms?: readonly unknown[]; children?: readonly unknown[] });
  };
  walk(stem.patch);
  return n;
};

/**
 * The whole arrangement as a stage hears it: each stem reduced to the hardware, summed into the stage's channel count and
 * clipped. Deterministic for a given `(song, stage, seed)`.
 */
export function renderSongMix(
  song: Song,
  stage: number,
  seed = 1,
): { readonly sampleRateHz: number; readonly channels: readonly Float32Array[]; readonly peak: number; readonly stems: readonly StemPreset[] } {
  const stems = songStems(song);
  const rendered = stems.map((s, i) => ({ stem: s, ...renderStem(s, stage, seed + i) }));
  const channels = audioStageFor(stage).channels;
  const length = rendered.reduce((m, r) => Math.max(m, r.channels[0]?.length ?? 0), 1);
  const out: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) out.push(new Float32Array(length));
  for (const r of rendered) {
    for (let c = 0; c < channels; c += 1) {
      const src = r.channels[Math.min(c, r.channels.length - 1)]!;
      const dst = out[c]!;
      for (let i = 0; i < src.length; i += 1) dst[i] = (dst[i] as number) + (src[i] as number);
    }
  }
  let peak = 0;
  for (const ch of out) {
    for (let i = 0; i < ch.length; i += 1) {
      const v = Math.max(-1, Math.min(1, ch[i] as number));
      ch[i] = v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
  }
  return { sampleRateHz: audioStageFor(stage).sampleRateHz, channels: out, peak, stems };
}
