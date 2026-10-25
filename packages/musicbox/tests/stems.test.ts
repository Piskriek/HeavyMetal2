import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSong, transpose, type Song } from '../src/index';
import { TRACKS, TRACK_VOICE, atomsForNote, noteTiming, pitchToHz, renderSongMix, songAtomCount, songSeconds, songStem, songStems } from '../src/stems';
import { audioStageFor, countAtoms, stageSoundsLike, validateStem } from '@hm/soundlab';

const SONG = makeSong(7, 'heroic');

/** A song shell with only the notes given, for the cases a generated song never produces. */
const shell = (notes: Song['notes']): Song => ({ style: 'chill', key: 60, minor: false, bpm: 120, bars: 1, notes });

test('a pitch is a frequency, and an octave is a doubling', () => {
  assert.equal(pitchToHz(69), 440);
  assert.ok(Math.abs(pitchToHz(81) - 880) < 1e-9);
  assert.ok(Math.abs(pitchToHz(57) - 220) < 1e-9);
  assert.ok(pitchToHz(60) > 261 && pitchToHz(60) < 262);
  // nonsense is clamped into the audible shelf rather than NaN
  assert.ok(Number.isFinite(pitchToHz(-400)) && pitchToHz(-400) > 0);
  assert.ok(Number.isFinite(pitchToHz(Number.NaN)));
});

test('a song becomes four stems, one per track, and each one is a playable preset', () => {
  const stems = songStems(SONG);
  assert.deepEqual(stems.map((s) => s.id), ['music-drums', 'music-bass', 'music-chords', 'music-lead']);
  assert.deepEqual(stems.map((s) => s.role), ['music', 'music', 'music', 'music']);
  for (const stem of stems) assert.deepEqual(validateStem(stem), [], `${stem.id} must validate`);
  assert.deepEqual(TRACKS, ['drums', 'bass', 'chords', 'lead']);

  // every note of a track is a child patch, so the tree reads like the score and the count matches
  for (const track of TRACKS) {
    const notes = SONG.notes.filter((n) => n.track === track);
    const stem = songStem(SONG, track)!;
    assert.equal(stem.patch.children?.length, notes.length, `${track} must have one child per note`);
    assert.equal(stem.patch.atoms, undefined, `${track}: the notes belong in the children`);
    assert.deepEqual(stem.patch.children?.map((c) => c.name), notes.map((_, i) => `${track}-${i + 1}`));
    assert.ok(countAtoms(stem.patch) >= notes.length);
  }
  assert.equal(songAtomCount(SONG), stems.reduce((n, s) => n + countAtoms(s.patch), 0));

  // a track with nothing written is no stem at all
  const bare = shell([{ track: 'lead', beat: 0, length: 1, pitch: 72, velocity: 0.7 }]);
  assert.equal(songStem(bare, 'drums'), null);
  assert.deepEqual(songStems(bare).map((s) => s.id), ['music-lead']);
});

test('each track plays in its own voice: noise drums, a square bass, a triangle chord', () => {
  assert.equal(TRACK_VOICE.drums.wave, 'noise');
  assert.equal(TRACK_VOICE.bass.wave, 'square');
  assert.equal(TRACK_VOICE.chords.wave, 'triangle');
  assert.equal(TRACK_VOICE.lead.wave, 'square');
  assert.ok(TRACK_VOICE.bass.filter && TRACK_VOICE.bass.filter.freq[0] < 1000, 'the bass is filtered dark');

  const lead = SONG.notes.find((n) => n.track === 'lead') ?? SONG.notes[0]!;
  const leadAtom = atomsForNote(SONG, 'lead', lead)[0]!;
  assert.equal(leadAtom.wave, 'square');
  assert.ok(Math.abs(leadAtom.freqHz - pitchToHz(lead.pitch)) < 1e-9);
  assert.ok(leadAtom.filter, 'the lead has bite');

  // a kick is a low sine, a snare is noise with a body, a hat is a short hiss
  const kick = atomsForNote(SONG, 'drums', { track: 'drums', beat: 0, length: 0.5, pitch: 36, velocity: 0.85 });
  assert.equal(kick[0]!.wave, 'sine');
  assert.ok(kick[0]!.freqHz < 80);
  const snare = atomsForNote(SONG, 'drums', { track: 'drums', beat: 1, length: 0.5, pitch: 38, velocity: 0.75 });
  assert.equal(snare[0]!.wave, 'noise');
  assert.ok((snare[1]?.wave ?? 'none') !== 'noise', 'a snare has a body under the noise');
  const hat = atomsForNote(SONG, 'drums', { track: 'drums', beat: 2, length: 0.25, pitch: 42, velocity: 0.6 });
  assert.equal(hat.length, 1);
  assert.ok(hat[0]!.decayMs <= 60, 'a hat is short');

  // a soft note is quieter than a loud one, and the note's written length is its ring
  const loud = atomsForNote(SONG, 'chords', { track: 'chords', beat: 0, length: 4, pitch: 60, velocity: 1 });
  const soft = atomsForNote(SONG, 'chords', { track: 'chords', beat: 0, length: 4, pitch: 60, velocity: 0.2 });
  assert.ok(loud[0]!.gain > soft[0]!.gain);
});

test('a note lands where the beat says, and the stem loops for the length of the song', () => {
  for (const stem of songStems(SONG)) assert.equal(stem.loopSeconds, Number(songSeconds(SONG).toFixed(4)));
  // 8 bars at the song's tempo, whatever the style
  assert.ok(songSeconds(SONG) > 8);
  const b = 60 / SONG.bpm;
  const first = noteTiming(SONG, { track: 'bass', beat: 0, length: 1, pitch: 40, velocity: 1 }, 0.85);
  const later = noteTiming(SONG, { track: 'bass', beat: 2, length: 1, pitch: 40, velocity: 1 }, 0.85);
  assert.equal(first.delayMs, 0);
  assert.ok(Math.abs(later.delayMs - 2 * b * 1000) < 1e-6);
  assert.ok(Math.abs(first.decayMs - b * 0.85 * 1000) < 1e-6);
  // a very short note still has a ring
  assert.ok(noteTiming(SONG, { track: 'drums', beat: 0, length: 0.0001, pitch: 42, velocity: 1 }, 1).decayMs >= 20);
});

test('the mix is deterministic, obeys the stage, and clips instead of blowing up', () => {
  const a = renderSongMix(SONG, 6, 5);
  const b = renderSongMix(SONG, 6, 5);
  assert.equal(a.sampleRateHz, 48000);
  assert.equal(a.channels.length, 2);
  assert.equal(a.channels[0]!.length, b.channels[0]!.length);
  assert.deepEqual([...a.channels[0]!.slice(0, 5000)], [...b.channels[0]!.slice(0, 5000)]);
  assert.ok(a.peak > 0.05 && a.peak <= 1);

  const mono = renderSongMix(SONG, 2, 5);
  assert.equal(mono.sampleRateHz, audioStageFor(2).sampleRateHz);
  assert.equal(mono.channels.length, 1);
  assert.ok(mono.channels[0]!.length < a.channels[0]!.length, 'a lower sample rate gives fewer samples');

  // a spatial stage places the tracks apart; a mono stage has nowhere to put them
  const spatial = renderSongMix(SONG, 6, 5);
  const left = spatial.channels[0]!;
  const right = spatial.channels[1]!;
  let differs = 0;
  for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) differs += 1;
  assert.ok(differs > left.length / 2, 'the two channels must not be the same signal');

  // at S0 the whole arrangement is one voice, because that is what the hardware has
  const first = songStems(SONG)[0]!;
  assert.equal(countAtoms(stageSoundsLike(first, 0).patch), 1);
  const speaker = renderSongMix(SONG, 0, 5);
  const values = new Set<number>();
  for (let i = 0; i < 4000; i += 1) values.add(speaker.channels[0]![i]!);
  for (const v of values) assert.ok(v === -1 || v === 0 || v === 1, `a 1-bit mix cannot hold ${v}`);
});

test('a transposed song transposes its stems, and every style writes stems that validate', () => {
  const up = transpose(SONG, 12);
  const originalLead = songStem(SONG, 'lead')!;
  const upLead = songStem(up, 'lead')!;
  const freqOf = (stem: typeof originalLead): number => {
    const child = stem.patch.children?.[0];
    return child?.atoms?.[0]?.freqHz ?? 0;
  };
  // the first lead note transposed by an octave is the same note, twice as high
  assert.ok(originalLead.patch.children?.length && upLead.patch.children?.length);
  assert.ok(Math.abs(freqOf(upLead) - freqOf(originalLead) * 2) < 1e-6);

  for (const style of ['chill', 'bouncy', 'spooky', 'heroic'] as const) {
    for (const seed of [1, 2, 3]) {
      const song = makeSong(seed, style);
      const stems = songStems(song);
      assert.ok(stems.length >= 3, `${style}/${seed} must have an arrangement`);
      for (const stem of stems) assert.deepEqual(validateStem(stem), [], `${style}/${seed} ${stem.id}`);
      assert.ok(songAtomCount(song) > 20, `${style}/${seed} writes a whole song`);
    }
  }
  // no notes at all is an empty mix, not a throw
  const empty = renderSongMix(shell([]), 6, 1);
  assert.equal(empty.stems.length, 0);
  assert.equal(empty.peak, 0);
});
