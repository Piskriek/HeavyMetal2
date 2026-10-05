import test from 'node:test';
import assert from 'node:assert/strict';
import { beatSeconds, makeSong, scale, transpose, window, type Style } from '../src/index';

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

test('every style produces the documented bpm/scale and stays deterministic', () => {
  const expectations: Record<Style, { bpm: number; minor: boolean }> = {
    chill: { bpm: 84, minor: false },
    bouncy: { bpm: 120, minor: false },
    spooky: { bpm: 96, minor: true },
    heroic: { bpm: 132, minor: false },
  };
  for (const style of Object.keys(expectations) as Style[]) {
    const exp = expectations[style];
    const s = makeSong(42, style);
    assert.equal(s.bpm, exp.bpm);
    assert.equal(s.minor, exp.minor);
    assert.equal(s.bars, 8);
    assert.deepEqual(s, makeSong(42, style));
  }
});

test('lead notes only ever use scale degrees relative to the key', () => {
  for (const style of ['chill', 'bouncy', 'spooky', 'heroic'] as Style[]) {
    const s = makeSong(99, style, 60);
    const sc = scale(s.minor);
    const lead = s.notes.filter((n) => n.track === 'lead');
    assert.ok(lead.length > 0);
    for (const n of lead) {
      const rel = ((n.pitch - s.key) % 12 + 12) % 12;
      assert.ok(sc.includes(rel), `pitch ${n.pitch} (rel ${rel}) not in scale for ${style}`);
      assert.ok(n.length <= 2);
      assert.ok(n.pitch >= s.key + 12 && n.pitch <= s.key + 24);
    }
    // nothing starts in the last half beat of the loop
    const loopLen = s.bars * 4;
    assert.ok(lead.every((n) => n.beat < loopLen - 0.5));
  }
});

test('window wraps for an arbitrary offset and matches a non-wrapping equivalent', () => {
  const s = makeSong(5, 'heroic');
  const loopLen = s.bars * 4;
  const w1 = window(s, loopLen - 1, loopLen + 1);
  const w2 = window(s, loopLen - 1, loopLen).concat(window(s, 0, 1));
  const sortFn = (a: { beat: number; track: string }, b: { beat: number; track: string }) =>
    a.beat - b.beat || a.track.localeCompare(b.track);
  assert.deepEqual([...w1].sort(sortFn), [...w2].sort(sortFn));
});

test('transpose shifts every track except drums, and the key', () => {
  const s = makeSong(11, 'bouncy');
  const t = transpose(s, 5);
  assert.equal(t.key, s.key + 5);
  for (let i = 0; i < s.notes.length; i++) {
    const orig = s.notes[i];
    const moved = t.notes[i];
    if (orig === undefined || moved === undefined) continue;
    if (orig.track === 'drums') {
      assert.equal(moved.pitch, orig.pitch);
    } else {
      assert.equal(moved.pitch, orig.pitch + 5);
    }
  }
});

test('every note stays fully inside the loop, for every style and several seeds', () => {
  for (const style of ['chill', 'bouncy', 'spooky', 'heroic'] as Style[]) {
    for (const seed of [0, 1, 2, 123, 999]) {
      const s = makeSong(seed, style);
      const loopLen = s.bars * 4;
      for (const n of s.notes) {
        assert.ok(n.beat >= 0, `negative beat in ${style}/${seed}`);
        assert.ok(n.beat + n.length <= loopLen + 1e-9, `note escapes loop in ${style}/${seed}`);
        assert.ok(n.velocity >= 0 && n.velocity <= 1);
      }
    }
  }
});

test('spooky style has no hats and kicks only on beat 1 of each bar', () => {
  const s = makeSong(2, 'spooky');
  const hats = s.notes.filter((n) => n.pitch === 42);
  assert.equal(hats.length, 0);
  const kicks = s.notes.filter((n) => n.track === 'drums' && n.pitch === 36).map((n) => n.beat);
  assert.deepEqual(kicks, [0, 4, 8, 12, 16, 20, 24, 28]);
});