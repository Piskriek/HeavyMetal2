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

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scale(minor: boolean): number[] {
  return minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
}

export const beatSeconds = (song: Song): number => 60 / song.bpm;

export function transpose(song: Song, semitones: number): Song {
  return {
    ...song,
    key: song.key + semitones,
    notes: song.notes.map((n) =>
      n.track === 'drums' ? { ...n } : { ...n, pitch: n.pitch + semitones }
    ),
  };
}

export function window(song: Song, fromBeat: number, toBeat: number): Note[] {
  const total = song.bars * 4;
  if (total <= 0 || toBeat <= fromBeat) return [];
  const span = toBeat - fromBeat;
  if (span >= total) return [...song.notes];
  const start = ((fromBeat % total) + total) % total;
  const end = start + span;
  if (end <= total) {
    return song.notes.filter((n) => n.beat >= start && n.beat < end);
  }
  const wrapEnd = end - total;
  return song.notes.filter((n) => n.beat >= start || n.beat < wrapEnd);
}

interface LeadNoteItem {
  beatRel: number;
  length: number;
  degreeIdx: number;
}

const STYLE_DEFAULTS: Record<Style, { bpm: number; minor: boolean }> = {
  chill: { bpm: 84, minor: false },
  bouncy: { bpm: 120, minor: false },
  spooky: { bpm: 96, minor: true },
  heroic: { bpm: 132, minor: false },
};

const MAJOR_PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 4, 5, 3], // I - V - vi - IV
  [5, 3, 0, 4], // vi - IV - I - V
  [0, 3, 4, 3], // I - IV - V - IV
];

const MINOR_PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 5, 2, 6], // i - VI - III - VII
  [0, 3, 4, 0], // i - iv - v - i
];

function getScaleDegree(sc: readonly number[], degreeIndex: number): number {
  const len = sc.length;
  if (len === 0) return 0;
  const idx = ((degreeIndex % len) + len) % len;
  const val = sc[idx];
  return val !== undefined ? val : 0;
}

export function makeSong(seed: number, style: Style, key = 60): Song {
  const rand = mulberry32(seed);
  const cfg = STYLE_DEFAULTS[style];
  const minor = cfg.minor;
  const bpm = cfg.bpm;
  const bars = 8;
  const sc = scale(minor);

  const progs = minor ? MINOR_PROGRESSIONS : MAJOR_PROGRESSIONS;
  const progIdx = Math.floor(rand() * progs.length);
  const progression = progs[progIdx] ?? progs[0] ?? [0, 4, 5, 3];

  const notes: Note[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const chordDegree = progression[bar % progression.length] ?? 0;
    const barStart = bar * 4;

    const rSemi = getScaleDegree(sc, chordDegree);
    const tSemi = getScaleDegree(sc, chordDegree + 2);
    const fSemi = getScaleDegree(sc, chordDegree + 4);

    notes.push(
      { track: 'chords', beat: barStart, length: 4, pitch: key + 12 + rSemi, velocity: 0.65 },
      { track: 'chords', beat: barStart, length: 4, pitch: key + 12 + tSemi, velocity: 0.65 },
      { track: 'chords', beat: barStart, length: 4, pitch: key + 12 + fSemi, velocity: 0.65 }
    );

    const bassPitch = key - 12 + rSemi;
    const bassBeats = style === 'bouncy' ? [0, 1, 2, 3] : [0, 2];
    for (const b of bassBeats) {
      notes.push({
        track: 'bass',
        beat: barStart + b,
        length: 1,
        pitch: bassPitch,
        velocity: 0.8,
      });
    }

    if (style === 'spooky') {
      notes.push({ track: 'drums', beat: barStart + 0, length: 0.5, pitch: 36, velocity: 0.85 });
    } else {
      notes.push({ track: 'drums', beat: barStart + 0, length: 0.5, pitch: 36, velocity: 0.85 });
      notes.push({ track: 'drums', beat: barStart + 2, length: 0.5, pitch: 36, velocity: 0.85 });
    }

    notes.push({ track: 'drums', beat: barStart + 1, length: 0.5, pitch: 38, velocity: 0.75 });
    notes.push({ track: 'drums', beat: barStart + 3, length: 0.5, pitch: 38, velocity: 0.75 });

    if (style !== 'spooky') {
      for (let s = 0; s < 8; s++) {
        notes.push({
          track: 'drums',
          beat: barStart + s * 0.5,
          length: 0.25,
          pitch: 42,
          velocity: s % 2 === 0 ? 0.65 : 0.5,
        });
      }
    }
  }

  const leadScale: number[] = [];
  for (const s of sc) {
    leadScale.push(key + 12 + s);
  }
  leadScale.push(key + 24);

  const phraseA: LeadNoteItem[] = [];
  let t = 0;
  let degIdx = Math.floor(rand() * leadScale.length);

  while (t < 8) {
    const rem = 8 - t;
    const choices = [0.5, 1, 1, 1.5, 2].filter((l) => l <= rem);
    const len = choices[Math.floor(rand() * choices.length)] ?? rem;
    if (len <= 0) break;

    if (t > 0 && rand() < 0.15) {
      t += len;
      continue;
    }

    const stepRoll = rand();
    let step: number;
    if (stepRoll < 0.85) {
      const stepOptions = [-2, -1, 1, 2];
      step = stepOptions[Math.floor(rand() * stepOptions.length)] ?? 1;
    } else {
      const jumpOptions = [-3, 0, 3];
      step = jumpOptions[Math.floor(rand() * jumpOptions.length)] ?? 0;
    }

    degIdx = Math.max(0, Math.min(leadScale.length - 1, degIdx + step));
    phraseA.push({ beatRel: t, length: len, degreeIdx: degIdx });
    t += len;
  }

  const varyPhrase = (base: readonly LeadNoteItem[]): LeadNoteItem[] => {
    return base.map((item) => {
      if (rand() < 0.4) {
        const stepOptions = [-2, -1, 1, 2];
        const step = stepOptions[Math.floor(rand() * stepOptions.length)] ?? 1;
        const newDeg = Math.max(0, Math.min(leadScale.length - 1, item.degreeIdx + step));
        return { ...item, degreeIdx: newDeg };
      }
      return { ...item };
    });
  };

  const phraseA_var1 = varyPhrase(phraseA);
  const phraseA_var2 = varyPhrase(phraseA);

  const chunks: readonly LeadNoteItem[][] = [phraseA, phraseA_var1, phraseA, phraseA_var2];

  for (let c = 0; c < 4; c++) {
    const chunk = chunks[c] ?? phraseA;
    const chunkStart = c * 8;
    for (const item of chunk) {
      const noteBeat = chunkStart + item.beatRel;
      if (noteBeat >= 31.5) continue;
      let noteLen = item.length;
      if (noteBeat + noteLen > 31.5) {
        noteLen = 31.5 - noteBeat;
      }
      if (noteLen <= 0) continue;

      const pitch = leadScale[item.degreeIdx] ?? key + 12;
      const velocity = Math.round((0.7 + rand() * 0.25) * 100) / 100;
      notes.push({
        track: 'lead',
        beat: noteBeat,
        length: noteLen,
        pitch,
        velocity,
      });
    }
  }

  notes.sort((a, b) => a.beat - b.beat || a.track.localeCompare(b.track));

  return {
    style,
    key,
    minor,
    bpm,
    bars,
    notes,
  };
}