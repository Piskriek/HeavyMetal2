/**
 * BUILDER KEYS: the editor's bindings. The defaults never give one key two jobs in a mode, the fly keys
 * only fly, Escape never leaves the editor, and a rebind moves a taken key instead of doubling it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDER_ACTIONS, BuilderKeys, chordOf, findBindingConflicts, prettyChord, readKeyOverrides, reservedChord, writeKeyOverrides,
} from '../src/game/builder/builder-keys';

const ev = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ code, ...mods });

test('the defaults have no conflicts, and every action id is unique', () => {
  assert.deepEqual(findBindingConflicts(new BuilderKeys()), []);
  assert.equal(new Set(BUILDER_ACTIONS.map((a) => a.id)).size, BUILDER_ACTIONS.length);
});

test('fly keys only fly: W, A, S, D, Space, Z and Q press nothing', () => {
  const keys = new BuilderKeys();
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyZ', 'KeyQ']) {
    assert.equal(keys.match(ev(code), 'pro'), null, `${code} in pro`);
    assert.equal(keys.match(ev(code), 'easy'), null, `${code} in easy`);
  }
  assert.ok(keys.held('fly.forward', new Set(['KeyW'])));
  assert.ok(keys.held('fly.down', new Set(['KeyQ'])));
});

test('modes: digits pick pieces in Easy Build, 5 is the nudge axis in Pro; Cmd counts as Ctrl', () => {
  const keys = new BuilderKeys();
  assert.equal(keys.match(ev('Digit5'), 'easy'), 'easy.item5');
  assert.equal(keys.match(ev('Digit5'), 'pro'), 'edit.nudgeAxis');
  assert.equal(keys.match(ev('KeyZ', { metaKey: true }), 'pro'), 'edit.undo');
  assert.equal(keys.match(ev('KeyZ', { ctrlKey: true, shiftKey: true }), 'pro'), 'edit.redo');
  assert.equal(keys.match(ev('KeyG'), 'pro'), 'gizmo.move');
  assert.equal(keys.match(ev('KeyG', { ctrlKey: true }), 'pro'), 'edit.group');
  assert.equal(keys.match(ev('Escape'), 'pro'), 'edit.cancel', 'Escape cancels; it never leaves the editor');
});

test('rebinding a taken key moves it; reset and storage round-trip', () => {
  const keys = new BuilderKeys();
  const { overrides, moved } = keys.rebind('race.test', 'KeyG');
  assert.deepEqual(moved, ['Move handles']);
  const next = new BuilderKeys(overrides);
  assert.equal(next.match(ev('KeyG'), 'pro'), 'race.test');
  assert.deepEqual(next.keysOf('gizmo.move'), []);
  assert.deepEqual(findBindingConflicts(next), []);
  assert.equal(next.label('race.test'), 'G');
  assert.deepEqual(new BuilderKeys(next.reset('race.test')).keysOf('race.test'), ['KeyP']);

  const m = new Map<string, string>();
  const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
  writeKeyOverrides(overrides, store);
  assert.deepEqual(readKeyOverrides(store), overrides);
  m.set('hm2-builder-keys-v1', '{"nope":["KeyX"],"race.test":[1,"KeyG"]}');
  assert.deepEqual(readKeyOverrides(store), { 'race.test': ['KeyG'] }, 'unknown actions and bad keys are dropped');
  writeKeyOverrides({}, store);
  assert.equal(m.size, 0);
});

test('chords read well and browser keys are refused', () => {
  assert.equal(chordOf(ev('KeyZ', { metaKey: true, shiftKey: true })), 'Ctrl+Shift+KeyZ');
  assert.equal(prettyChord('Ctrl+Shift+KeyZ'), 'Ctrl+Shift+Z');
  assert.equal(prettyChord('Numpad7'), 'Num 7');
  assert.equal(prettyChord('Shift+Slash'), '?');
  assert.equal(prettyChord('Comma'), ',');
  assert.ok(reservedChord('Ctrl+KeyW'));
  assert.equal(reservedChord('KeyP'), null);
});
