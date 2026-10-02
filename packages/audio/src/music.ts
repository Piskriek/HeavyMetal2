export type Mood = 'chill' | 'energetic' | 'dramatic';

export interface MusicNote {
  beat: number; /* start, in beats from the start of the pattern */
  duration: number; /* beats */
  midi: number;
  velocity: number; /* 1..127 */
  voice: 'bass' | 'lead' | 'pad' | 'perc';
}

export interface MusicPattern {
  bpm: number;
  bars: number;
  beatsPerBar: 4;
  key: number; /* MIDI root, 48..59 */
  notes: MusicNote[];
}

function mulberry32(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = [48, 50, 52, 55, 57] as const; // C3, D3, E3, G3, A3

// Chill / Energetic: I - vi - IV - V  (root offsets in semitones: 0, 9, 5, 7)
// Triad intervals from root:
// I (major): [0, 4, 7]
// vi (minor): [9, 12, 16] -> [9, 0, 4]
// IV (major): [5, 9, 12] -> [5, 9, 0]
// V (major): [7, 11, 14] -> [7, 11, 2]
const CHORDS_MAJOR: readonly (readonly [number, readonly number[]])[] = [
  [0, [0, 4, 7]],
  [9, [9, 12, 16]],
  [5, [5, 9, 12]],
  [7, [7, 11, 14]],
];

// Dramatic: i - VI - III - VII (minor: 0, 8, 3, 10)
// i (minor): [0, 3, 7]
// VI (major): [8, 12, 15]
// III (major): [3, 7, 10]
// VII (major): [10, 14, 17]
const CHORDS_DRAMATIC: readonly (readonly [number, readonly number[]])[] = [
  [0, [0, 3, 7]],
  [8, [8, 12, 15]],
  [3, [3, 7, 10]],
  [10, [10, 14, 17]],
];

const PENTA_MAJOR = [0, 2, 4, 7, 9] as const;
const PENTA_MINOR = [0, 3, 5, 7, 10] as const;

export function musicPattern(
  seed: number,
  bars: number,
  opts?: { mood?: Mood; bpm?: number },
): MusicPattern {
  const mood = opts?.mood ?? 'chill';
  const bpm =
    opts?.bpm ?? (mood === 'energetic' ? 138 : mood === 'dramatic' ? 112 : 100);

  if (bars <= 0) {
    return {
      bpm,
      bars: 0,
      beatsPerBar: 4,
      key: 48,
      notes: [],
    };
  }

  const rng = mulberry32(seed);
  const keyIndex = Math.floor(rng() * KEYS.length);
  const key = KEYS[keyIndex] ?? 48;

  const notes: MusicNote[] = [];
  const chords = mood === 'dramatic' ? CHORDS_DRAMATIC : CHORDS_MAJOR;
  const penta = mood === 'dramatic' ? PENTA_MINOR : PENTA_MAJOR;

  for (let bar = 0; bar < bars; bar++) {
    const chordInfo = chords[bar % chords.length] ?? chords[0]!;
    const [rootOffset, chordTones] = chordInfo;
    const barStart = bar * 4;

    // --- BASS ---
    // 'bass' = a root note on beat 1 of EVERY bar (plus an octave/fifth pulse on beat 3 for energetic)
    const bassRootMidi = key + rootOffset; // MIDI ~48..67
    const bassNote1Midi = bassRootMidi > 55 ? bassRootMidi - 12 : bassRootMidi;

    if (mood === 'energetic') {
      notes.push({
        beat: barStart,
        duration: 1.8,
        midi: bassNote1Midi,
        velocity: 100,
        voice: 'bass',
      });
      const pulseType = rng() > 0.5 ? 12 : 7; // octave or fifth
      notes.push({
        beat: barStart + 2,
        duration: 1.8,
        midi: bassNote1Midi + pulseType,
        velocity: 95,
        voice: 'bass',
      });
    } else {
      notes.push({
        beat: barStart,
        duration: 3.8,
        midi: bassNote1Midi,
        velocity: mood === 'dramatic' ? 95 : 85,
        voice: 'bass',
      });
    }

    // --- PAD ---
    // 'pad' = a held triad per bar
    // Triad 1 octave above root
    for (const tone of chordTones) {
      notes.push({
        beat: barStart,
        duration: 3.9,
        midi: key + 12 + tone,
        velocity: mood === 'chill' ? 55 : 65,
        voice: 'pad',
      });
    }

    // --- PERCUSSION ---
    // 'perc' = midi 36 (kick) on beats 1 and 3, midi 42 (hat) on every 8th for energetic, only kicks for chill.
    // Kick on beat 1 and 3
    notes.push({
      beat: barStart,
      duration: 0.4,
      midi: 36,
      velocity: 110,
      voice: 'perc',
    });
    notes.push({
      beat: barStart + 2,
      duration: 0.4,
      midi: 36,
      velocity: 105,
      voice: 'perc',
    });

    if (mood === 'energetic') {
      // 8th-note hats (beats 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5)
      for (let s = 0; s < 8; s++) {
        notes.push({
          beat: barStart + s * 0.5,
          duration: 0.2,
          midi: 42,
          velocity: s % 2 === 0 ? 80 : 65,
          voice: 'perc',
        });
      }
    } else if (mood === 'dramatic') {
      // snare / tom on beat 3 or 4
      notes.push({
        beat: barStart + 3,
        duration: 0.3,
        midi: 38,
        velocity: 80,
        voice: 'perc',
      });
    }
  }

  // --- LEAD ---
  // 'lead' = a melodic line of 2-6 notes per bar on the 8th-note grid with at least one rest per 2 bars
  // lead notes drawn from pentatonic 1-2 octaves above root (key + 12 or + 24)
  // No two notes of the same voice overlap in time
  for (let pair = 0; pair < Math.ceil(bars / 2); pair++) {
    const pairStartBar = pair * 2;
    const pairBars = Math.min(2, bars - pairStartBar);

    // Pick 1 bar in this pair to have a designated resting window or lighter note count
    const restBarIndex = pairBars === 2 ? Math.floor(rng() * 2) : 0;

    for (let b = 0; b < pairBars; b++) {
      const currentBar = pairStartBar + b;
      const barStart = currentBar * 4;
      const isRestBar = b === restBarIndex;

      // Available 8th note slots: 0 to 7 (step 0.5)
      // We need 2-6 notes per bar.
      const targetCount = isRestBar
        ? 2 + Math.floor(rng() * 2) // 2-3 notes
        : 3 + Math.floor(rng() * 3); // 3-5 notes

      // Pick non-overlapping slots on 8th grid
      const candidateSlots = [0, 1, 2, 3, 4, 5, 6, 7];
      // Shuffle candidate slots
      for (let i = candidateSlots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const temp = candidateSlots[i]!;
        candidateSlots[i] = candidateSlots[j]!;
        candidateSlots[j] = temp;
      }
      const selected = candidateSlots.slice(0, targetCount).sort((x, y) => x - y);

      for (let i = 0; i < selected.length; i++) {
        const slot = selected[i]!;
        const nextSlot = i + 1 < selected.length ? selected[i + 1]! : 8;
        const maxDur = (nextSlot - slot) * 0.5;
        // duration strictly less than or equal to maxDur, and not overlapping
        const dur = Math.min(maxDur * 0.9, 0.45);

        // Pick pentatonic note: 1-2 octaves above key
        const octaveOffset = rng() > 0.4 ? 24 : 12;
        const pentaDegree = penta[Math.floor(rng() * penta.length)]!;
        const midi = key + octaveOffset + pentaDegree;
        const velocity = 75 + Math.floor(rng() * 35);

        notes.push({
          beat: barStart + slot * 0.5,
          duration: Math.max(0.2, dur),
          midi,
          velocity,
          voice: 'lead',
        });
      }
    }
  }

  // Ensure notes are sorted cleanly by beat
  notes.sort((a, b) => a.beat - b.beat);

  return {
    bpm,
    bars,
    beatsPerBar: 4,
    key,
    notes,
  };
}

export function patternDurationSec(p: MusicPattern): number {
  return (p.bars * 4 * 60) / p.bpm;
}
