import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineOf, changesBetween, gameplayKeys, summarise, type Snap } from '../src';

const snap = (id: string, kind: string, params: Record<string, unknown>, hash = JSON.stringify(params), children: Record<string, string[]> = {}): Snap => ({ id, kind, name: id, hash, author: 'me', params, children });
const keys = (k: string): string[] => (k === 'race' ? ['laps', 'field', 'rumble'] : k === 'interface' ? ['accent', 'title'] : k === 'item' ? ['label', 'icon', 'effect', 'power'] : []);

test('gameplay keys: whole kinds, listed keys, unknown kinds', () => {
  assert.deepEqual([...gameplayKeys('race', ['a', 'b'])], ['a', 'b']);
  assert.ok(gameplayKeys('item', []).has('power'));
  assert.ok(!gameplayKeys('item', []).has('label'));
  assert.equal(gameplayKeys('interface', ['accent']).size, 0);
});

test('a laps change is gameplay, an accent colour is cosmetic, an item rename is cosmetic', () => {
  const base = baselineOf([snap('r', 'race', { laps: 3 }), snap('ui', 'interface', { accent: 'red' }), snap('i', 'item', { label: 'Boost', power: 1 })]);
  const now = [snap('r', 'race', { laps: 5 }), snap('ui', 'interface', { accent: 'blue' }), snap('i', 'item', { label: 'Zoom', power: 1 })];
  const c = changesBetween(base, now, keys);
  assert.deepEqual(c.map((x) => [x.id, x.class]), [['r', 'gameplay'], ['i', 'cosmetic'], ['ui', 'cosmetic']]);
  assert.deepEqual(c[0]!.keys, ['laps']);
  assert.equal(summarise(c).text, '1 change affects how the race plays; 2 are only looks and sounds.');
});

test('unchanged presets are not listed; new gameplay presets count; removed ones too', () => {
  const base = baselineOf([snap('a', 'race', { laps: 3 }), snap('gone', 'item', { power: 1 })]);
  const c = changesBetween(base, [snap('a', 'race', { laps: 3 }), snap('new', 'item', { power: 2 }), snap('ui', 'interface', {})], keys);
  assert.deepEqual(c.map((x) => `${x.id}:${x.status}:${x.class}`), ['gone:removed:gameplay', 'new:added:gameplay', 'ui:added:cosmetic']);
  assert.equal(summarise([]).text, 'No changes yet.');
});

test('adding an item to the scene slot changes the scene in a gameplay way, adding a sound does not', () => {
  const base = baselineOf([snap('scene', 'scene', {}, 'h0', { items: [] })]);
  const withItem = snap('scene', 'scene', {}, 'h1', { items: ['i1'] });
  const withSound = snap('scene', 'scene', {}, 'h2', { sounds: ['s1'] });
  assert.equal(changesBetween(base, [withItem], keys)[0]!.class, 'gameplay');
  assert.equal(changesBetween(base, [withSound], keys)[0]!.class, 'cosmetic');
});

test('summary wording for none-gameplay', () => {
  const c = changesBetween(baselineOf([snap('ui', 'interface', { accent: 'a' })]), [snap('ui', 'interface', { accent: 'b' })], keys);
  assert.equal(summarise(c).text, 'Nothing you changed affects how the race plays; 1 is only looks and sounds.');
});
