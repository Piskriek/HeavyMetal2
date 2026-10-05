import test from 'node:test';
import assert from 'node:assert/strict';
import { beatSeconds, makeSong, scale, transpose, window } from '../src/index';

test('same seed, same song; different seed, different lead', () => {
  assert.deepEqual(makeSong(7, 'chill'), makeSong(7, 'chill'));
  const a = makeSong(7, 'chill').notes.filter((n) => n.track === 'lead').map((n) => n.pitch);
  const b = makeSong(8, 'chill').notes.filter((n) => n.track === 'lead').map((n) => n.pitch);
  assert.notDeepEqual(a, b);
});

test('style defaults', () => {
  const s = makeSong(1, 'spooky', 57);
  assert.equal(s.bpm, 96);
  assert.equal(s.minor, true);
  assert.equal(s.bars, 8);
  assert.equal(s.key, 57);
  assert.ok(Math.abs(beatSeconds(s) - 0.625) < 1e-9);
  assert.deepEqual(scale(false), [0, 2, 4, 5, 7, 9, 11]);
});

test('drums on the beat; the window wraps', () => {
  const s = makeSong(3, 'chill');
  const kicks = s.notes.filter((n) => n.track === 'drums' && n.pitch === 36).map((n) => n.beat);
  assert.deepEqual(kicks.slice(0, 4), [0, 2, 4, 6]);
  const w = window(s, 31.5, 32.5);
  assert.ok(w.some((n) => n.beat === 0 && n.track === 'drums'));
});

test('every style defaults and characteristics', () => {
  const chill = makeSong(10, 'chill');
  assert.equal(chill.bpm, 84);
  assert.equal(chill.minor, false);
  assert.equal(chill.bars, 8);
  assert.equal(chill.key, 60);

  const bouncy = makeSong(11, 'bouncy');
  assert.equal(bouncy.bpm, 120);
  assert.equal(bouncy.minor, false);
  assert.equal(bouncy.bars, 8);
  const bouncyBass = bouncy.notes.filter((n) => n.track === 'bass');
  assert.equal(bouncyBass.length, 32);

  const spooky = makeSong(12, 'spooky');
  assert.equal(spooky.bpm, 96);
  assert.equal(spooky.minor, true);
  assert.equal(spooky.bars, 8);
  assert.ok(!spooky.notes.some((n) => n.track === 'drums' && n.pitch === 42));
  const spookyKicks = spooky.notes.filter((n) => n.track === 'drums' && n.pitch === 36);
  assert.equal(spookyKicks.length, 8);

  const heroic = makeSong(13, 'heroic');
  assert.equal(heroic.bpm, 132);
  assert.equal(heroic.minor, false);
  assert.equal(heroic.bars, 8);
});

test('lead stays in the scale and within bounds', () => {
  const styles = ['chill', 'bouncy', 'spooky', 'heroic'] as const;
  for (const style of styles) {
    for (let seed = 1; seed <= 5; seed++) {
      const song = makeSong(seed, style, 62);
      const sc = scale(song.minor);
      const leadNotes = song.notes.filter((n) => n.track === 'lead');
      assert.ok(leadNotes.length > 0);
      for (const note of leadNotes) {
        const degree = ((note.pitch - song.key) % 12 + 12) % 12;
        assert.ok(
          sc.includes(degree),
          `Lead note pitch ${note.pitch} degree ${degree} not in scale for style ${style}`
        );
        assert.ok(note.length <= 2, `Lead note length ${note.length} exceeds 2 beats`);
        assert.ok(
          note.pitch >= song.key + 12 && note.pitch <= song.key + 24,
          `Lead pitch ${note.pitch} outside [${song.key + 12}, ${song.key + 24}]`
        );
        assert.ok(
          note.beat + note.length <= 31.5,
          `Lead note ends at ${note.beat + note.length}, crosses into last half beat`
        );
      }
    }
  }
});

test('window wraps round loop end', () => {
  const song = makeSong(42, 'heroic');
  const totalBeats = song.bars * 4;
  assert.equal(window(song, 5, 5).length, 0);
  assert.equal(window(song, 0, totalBeats).length, song.notes.length);

  const acrossBoundary = window(song, 31, 33);
  const part1 = song.notes.filter((n) => n.beat >= 31 && n.beat < 32);
  const part2 = song.notes.filter((n) => n.beat >= 0 && n.beat < 1);
  assert.equal(acrossBoundary.length, part1.length + part2.length);
});

test('transpose preserves drums and shifts other pitches', () => {
  const original = makeSong(99, 'chill', 60);
  const semitones = 5;
  const transposed = transpose(original, semitones);

  assert.equal(transposed.key, original.key + semitones);
  assert.equal(transposed.notes.length, original.notes.length);

  for (let i = 0; i < original.notes.length; i++) {
    const o = original.notes[i];
    const t = transposed.notes[i];
    assert.ok(o && t);
    assert.equal(t.track, o.track);
    assert.equal(t.beat, o.beat);
    assert.equal(t.length, o.length);
    assert.equal(t.velocity, o.velocity);
    if (o.track === 'drums') {
      assert.equal(t.pitch, o.pitch);
    } else {
      assert.equal(t.pitch, o.pitch + semitones);
    }
  }
});

test('notes stay inside the loop', () => {
  const styles = ['chill', 'bouncy', 'spooky', 'heroic'] as const;
  for (const style of styles) {
    for (let seed = 1; seed <= 5; seed++) {
      const song = makeSong(seed, style);
      const totalBeats = song.bars * 4;
      for (const n of song.notes) {
        assert.ok(n.beat >= 0, `Note beat ${n.beat} is negative`);
        assert.ok(
          n.beat + n.length <= totalBeats,
          `Note ${n.track} at ${n.beat} with length ${n.length} exceeds loop length ${totalBeats}`
        );
        if (n.track === 'drums') {
          assert.ok(
            n.velocity >= 0.4 && n.velocity <= 1.0,
            `Drum velocity ${n.velocity} not in [0.4, 1]`
          );
        }
      }
    }
  }
});