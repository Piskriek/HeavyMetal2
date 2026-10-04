// A tiny deterministic procedural music box for a toy-world game's Jukebox.
// No DOM, no Date, no Math.random: everything flows from a seeded PRNG.

export type Style = 'chill' | 'bouncy' | 'spooky' | 'heroic';
export type Track = 'drums' | 'bass' | 'chords' | 'lead';

export interface Note {
  track: Track;
  beat: number;
  length: number;
  pitch: number;
  velocity: number;
}

export interface Song {
  style: Style;
  key: number;
  minor: boolean;
  bpm: number;
  bars: number;
  notes: Note[];
}

interface StyleDefaults {
  bpm: number;
  minor: boolean;
}

const STYLE_DEFAULTS: Record<Style, StyleDefaults> = {
  chill: { bpm: 84, minor: false },
  bouncy: { bpm: 120, minor: false },
  spooky: { bpm: 96, minor: true },
  heroic: { bpm: 132, minor: false },
};

const BARS = 8;
const BEATS_PER_BAR = 4;
const MAX_LEAD_INDEX = 7; // scale-degree steps above the lead's base octave

// ---- seeded PRNG (mulberry32) ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  const idx = Math.min(arr.length - 1, Math.floor(rng() * arr.length));
  const val = arr[idx];
  if (val === undefined) {
    throw new Error('pickFrom: array is empty');
  }
  return val;
}

function mkNote(track: Track, beat: number, length: number, pitch: number, velocity: number): Note {
  return { track, beat, length, pitch, velocity: Math.max(0, Math.min(1, velocity)) };
}

function trackOrder(t: Track): number {
  switch (t) {
    case 'drums':
      return 0;
    case 'bass':
      return 1;
    case 'chords':
      return 2;
    case 'lead':
      return 3;
  }
}

export function scale(minor: boolean): number[] {
  return minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
}

function degreeSemitone(sc: readonly number[], idx: number): number {
  const wrapped = ((idx % sc.length) + sc.length) % sc.length;
  const v = sc[wrapped];
  if (v === undefined) {
    throw new Error('degreeSemitone: scale index out of range');
  }
  return v;
}

const MAJOR_PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 4, 5, 3], // I-V-vi-IV
  [5, 3, 0, 4], // vi-IV-I-V
  [0, 3, 4, 3], // I-IV-V-IV
];

const MINOR_PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 5, 2, 6], // i-VI-III-VII
  [0, 3, 4, 0], // i-iv-v-i
];

function triadNoteOffset(sc: readonly number[], degree: number, step: number): number {
  const idx = degree + step;
  const oct = Math.floor(idx / sc.length) * 12;
  return degreeSemitone(sc, idx) + oct;
}

function triadOffsets(sc: readonly number[], degree: number): [number, number, number] {
  return [triadNoteOffset(sc, degree, 0), triadNoteOffset(sc, degree, 2), triadNoteOffset(sc, degree, 4)];
}

function offsetFromLeadIndex(sc: readonly number[], idx: number): number {
  const oct = Math.floor(idx / sc.length) * 12;
  return degreeSemitone(sc, idx) + oct;
}

interface LeadSeg {
  beat: number;
  length: number;
  idx: number;
}

function buildLeadPhrase(rng: () => number, startIdx: number, phraseBeats: number): LeadSeg[] {
  const segs: LeadSeg[] = [];
  let beat = 0;
  let idx = startIdx;
  while (beat < phraseBeats) {
    const remaining = phraseBeats - beat;
    const candidates = [0.5, 1, 1.5, 2].filter((l) => l <= remaining + 1e-9);
    const length = pickFrom(rng, candidates);
    const r = rng();
    let step: number;
    if (r < 0.1) {
      step = 0;
    } else if (r < 0.45) {
      step = pickFrom(rng, [1, -1]);
    } else if (r < 0.85) {
      step = pickFrom(rng, [2, -2]);
    } else {
      step = pickFrom(rng, [1, -1, 2, -2, 3, -3]);
    }
    idx = Math.max(0, Math.min(MAX_LEAD_INDEX, idx + step));
    segs.push({ beat, length, idx });
    beat += length;
  }
  return segs;
}

function makeLead(rng: () => number, sc: readonly number[], key: number, bars: number): Note[] {
  const leadBase = key + 12;
  const phraseBeats = 2 * BEATS_PER_BAR;
  const startIdx = pickFrom(rng, [0, 1, 2, 3, 4]);
  const phraseA = buildLeadPhrase(rng, startIdx, phraseBeats);

  const phraseB: LeadSeg[] = phraseA.map((s) => ({ ...s }));
  const varyPos = Math.min(phraseB.length - 1, Math.floor(rng() * phraseB.length));
  const target = phraseB[varyPos];
  if (target !== undefined) {
    const delta = pickFrom(rng, [1, -1, 2, -2]);
    target.idx = Math.max(0, Math.min(MAX_LEAD_INDEX, target.idx + delta));
  }

  const reps = [phraseA, phraseB, phraseA, phraseB];
  const loopLen = bars * BEATS_PER_BAR;
  const notes: Note[] = [];
  for (let rep = 0; rep < reps.length; rep++) {
    const phrase = reps[rep];
    if (phrase === undefined) continue;
    const offset = rep * phraseBeats;
    for (const seg of phrase) {
      const absBeat = offset + seg.beat;
      if (absBeat >= loopLen - 0.5) continue; // nothing on the last half beat of the loop
      const pitch = leadBase + offsetFromLeadIndex(sc, seg.idx);
      const velocity = 0.55 + rng() * 0.35;
      notes.push(mkNote('lead', absBeat, Math.min(seg.length, 2), pitch, velocity));
    }
  }
  return notes;
}

function makeDrums(rng: () => number, style: Style, bars: number): Note[] {
  const notes: Note[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * BEATS_PER_BAR;
    notes.push(mkNote('drums', barStart, 1, 36, 0.7 + rng() * 0.3));
    if (style !== 'spooky') {
      notes.push(mkNote('drums', barStart + 2, 1, 36, 0.6 + rng() * 0.3));
    }
    notes.push(mkNote('drums', barStart + 1, 1, 38, 0.6 + rng() * 0.4));
    notes.push(mkNote('drums', barStart + 3, 1, 38, 0.6 + rng() * 0.4));
    if (style !== 'spooky') {
      for (let e = 0; e < 8; e++) {
        notes.push(mkNote('drums', barStart + e * 0.5, 0.5, 42, 0.4 + rng() * 0.3));
      }
    }
  }
  return notes;
}

function makeChordsAndBass(
  rng: () => number,
  sc: readonly number[],
  progression: readonly number[],
  style: Style,
  key: number,
  bars: number
): Note[] {
  const notes: Note[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const degree = progression[bar % progression.length];
    if (degree === undefined) continue;
    const barStart = bar * BEATS_PER_BAR;
    const [r, t, f] = triadOffsets(sc, degree);
    for (const off of [r, t, f]) {
      notes.push(mkNote('chords', barStart, BEATS_PER_BAR, key + 12 + off, 0.5 + rng() * 0.2));
    }
    const bassPitch = key - 12 + degreeSemitone(sc, degree);
    if (style === 'bouncy') {
      for (let b = 0; b < BEATS_PER_BAR; b++) {
        notes.push(mkNote('bass', barStart + b, 1, bassPitch, 0.6 + rng() * 0.3));
      }
    } else {
      notes.push(mkNote('bass', barStart, 2, bassPitch, 0.65 + rng() * 0.3));
      notes.push(mkNote('bass', barStart + 2, 2, bassPitch, 0.6 + rng() * 0.3));
    }
  }
  return notes;
}

export function makeSong(seed: number, style: Style, key: number = 60): Song {
  const defaults = STYLE_DEFAULTS[style];
  const minor = defaults.minor;
  const bpm = defaults.bpm;
  const bars = BARS;
  const sc = scale(minor);
  const rng = mulberry32(seed);

  const progressions = minor ? MINOR_PROGRESSIONS : MAJOR_PROGRESSIONS;
  const progression = pickFrom(rng, progressions);

  const notes: Note[] = [];
  notes.push(...makeDrums(rng, style, bars));
  notes.push(...makeChordsAndBass(rng, sc, progression, style, key, bars));
  notes.push(...makeLead(rng, sc, key, bars));

  const loopLen = bars * BEATS_PER_BAR;
  for (const n of notes) {
    const maxLen = loopLen - n.beat;
    if (n.length > maxLen) {
      n.length = maxLen;
    }
  }

  notes.sort((a, b) => a.beat - b.beat || trackOrder(a.track) - trackOrder(b.track) || a.pitch - b.pitch);

  return { style, key, minor, bpm, bars, notes };
}

export function window(song: Song, fromBeat: number, toBeat: number): Note[] {
  const loopLen = song.bars * BEATS_PER_BAR;
  const span = toBeat - fromBeat;
  if (span <= 0) return [];
  if (span >= loopLen) return song.notes.slice();

  const fromMod = ((fromBeat % loopLen) + loopLen) % loopLen;
  const toMod = fromMod + span;
  if (toMod <= loopLen) {
    return song.notes.filter((n) => n.beat >= fromMod && n.beat < toMod);
  }
  const wrappedTo = toMod - loopLen;
  return song.notes.filter((n) => n.beat >= fromMod || n.beat < wrappedTo);
}

export const beatSeconds = (song: Song): number => 60 / song.bpm;

export function transpose(song: Song, semitones: number): Song {
  const notes: Note[] = song.notes.map((n) =>
    n.track === 'drums' ? { ...n } : { ...n, pitch: n.pitch + semitones }
  );
  return { ...song, key: song.key + semitones, notes };
}