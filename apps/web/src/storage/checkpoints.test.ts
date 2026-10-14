import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKPOINT_FORMAT, CHECKPOINT_PROFILE_ID, applyCheckpoint, parseCheckpoint, type Checkpoint } from './checkpoints';

/** An in-memory Storage (the subset the checkpoint code uses). */
class MemoryStorage {
  private readonly map = new Map<string, string>();
  get length(): number { return this.map.size; }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  snapshot(): Record<string, string> { return Object.fromEntries([...this.map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))); }
}

const play = JSON.stringify({ v: 5, step: 'done', chain: { progress: { 'A4-01': 'done' }, counts: {}, monstersUnlocked: false, version: 2 } });
const good = (over: Record<string, unknown> = {}): string => JSON.stringify({
  format: CHECKPOINT_FORMAT, v: 1, name: 'act4-start', title: 'Act IV', act: 'IV',
  expect: { where: 'lab', step: 'A4-01' }, keys: { 'hm.setmix.play': play, 'hm-base-v1': '{"tick":3}' }, ...over,
});

test('a checkpoint file is read, and a file that is not one is refused with the reason', () => {
  const ok = parseCheckpoint(good());
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.checkpoint.name, 'act4-start');
    assert.deepEqual(ok.checkpoint.expect, { where: 'lab', step: 'A4-01' });
    assert.equal(Object.keys(ok.checkpoint.keys).length, 2);
  }
  assert.equal(parseCheckpoint('{ nope').ok, false);
  const notOurs = parseCheckpoint(JSON.stringify({ format: 'other' }));
  assert.equal(notOurs.ok, false);
  if (!notOurs.ok) assert.match(notOurs.why, /not a FIDELITY checkpoint/);
  const newer = parseCheckpoint(good({ v: 2 }));
  assert.equal(newer.ok, false);
  if (!newer.ok) assert.match(newer.why, /newer build/);
  const unknown = parseCheckpoint(good({ keys: { 'hm.setmix.play': play, 'hm.profile.v2': '{}' } }));
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.match(unknown.why, /unknown save key/);
  const noPlay = parseCheckpoint(good({ keys: { 'hm-base-v1': '{}' } }));
  assert.equal(noPlay.ok, false);
  if (!noPlay.ok) assert.match(noPlay.why, /no play state/);
});

test('loading a checkpoint writes only the Checkpoint profile: the player\'s own keys stay byte-identical, and the profile becomes active', () => {
  const s = new MemoryStorage();
  // the player's own (Main) profile: un-prefixed keys, and the device settings
  s.setItem('hm.setmix.play', '{"v":5,"step":"create","mine":true}');
  s.setItem('hm-base-v1', '{"tick":99,"mine":true}');
  s.setItem('hm.profile.v2', '{"quality":"low"}');
  const before = s.snapshot();
  const parsed = parseCheckpoint(good());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  applyCheckpoint(s as unknown as Storage, parsed.checkpoint as Checkpoint, 1000);
  const after = s.snapshot();
  for (const k of Object.keys(before)) {
    if (k === 'hm.profiles') continue;
    assert.equal(after[k], before[k], `the player's ${k} changed`);
  }
  assert.equal(after[`hm.p.${CHECKPOINT_PROFILE_ID}.hm.setmix.play`], play);
  const reg = JSON.parse(after['hm.profiles']!) as { active: string; list: { id: string; name: string }[] };
  assert.equal(reg.active, CHECKPOINT_PROFILE_ID);
  assert.ok(reg.list.some((p) => p.id === 'main') && reg.list.some((p) => p.id === CHECKPOINT_PROFILE_ID && p.name === 'Checkpoint'));
});

test('a second load replaces the checkpoint profile\'s save keys, and keeps its device settings', () => {
  const s = new MemoryStorage();
  const parsed = parseCheckpoint(good());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  s.setItem(`hm.p.${CHECKPOINT_PROFILE_ID}.hm.profile.v2`, '{"quality":"medium"}');
  s.setItem(`hm.p.${CHECKPOINT_PROFILE_ID}.hm.setmix.beam`, '{"stale":true}');
  applyCheckpoint(s as unknown as Storage, parsed.checkpoint as Checkpoint, 1);
  assert.equal(s.getItem(`hm.p.${CHECKPOINT_PROFILE_ID}.hm.setmix.beam`), null, 'a stale save key is gone');
  assert.equal(s.getItem(`hm.p.${CHECKPOINT_PROFILE_ID}.hm.profile.v2`), '{"quality":"medium"}', 'the device settings stay');
  assert.equal(s.getItem(`hm.p.${CHECKPOINT_PROFILE_ID}.hm-base-v1`), '{"tick":3}');
});
