import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOOKS, LOOK_SLOT_KEYS, LOOK_VARIABLES, lookById, nameProblem, normalizeLook, randomLook, recolour } from '../src';

test('names: short, long, odd characters, links and rude words are refused with a reason; good names pass', () => {
  for (const ok of ['Grub', 'Snik the Bold', "O'Gob", 'Zog-9', 'Élise']) assert.equal(nameProblem(ok), null, ok);
  for (const bad of ['', 'a', 'x'.repeat(21), '<script>', 'www.site', 'http stuff', 'shitgob', '  ']) assert.ok(nameProblem(bad), bad);
  assert.ok(nameProblem(5));
});

test('a look is always legal: bad colours fall back to the classic goblin, a bad name becomes Goblin', () => {
  const l = normalizeLook({ name: 'x', skin: 'red', eyes: '#FFAA00', id: 'mine' });
  assert.equal(l.name, 'Goblin');
  assert.equal(l.skin, LOOKS[0]!.skin);
  assert.equal(l.eyes, '#ffaa00');
  assert.deepEqual(normalizeLook(null).skin, LOOKS[0]!.skin);
  for (const look of LOOKS) assert.deepEqual(normalizeLook(look), look);
});

test('recolour changes only the named palette entries and leaves the others alone', () => {
  const pal = [{ name: 'skin', color: [0, 0, 0] as [number, number, number], roughness: 1 }, { name: 'shield-iron', color: [0.1, 0.2, 0.3] as [number, number, number], roughness: 0.3 }];
  const out = recolour(pal, lookById('frost'));
  assert.notDeepEqual(out[0]!.color, [0, 0, 0]);
  assert.deepEqual(out[1]!.color, [0.1, 0.2, 0.3]);
  assert.equal(out[1]!.roughness, 0.3);
  assert.deepEqual(pal[0]!.color, [0, 0, 0], 'the input is not changed');
});

test('ready-made looks are distinct, random looks are deterministic, every slot has a variable', () => {
  assert.equal(new Set(LOOKS.map((l) => l.skin)).size, LOOKS.length);
  assert.deepEqual(randomLook(7), randomLook(7));
  assert.notDeepEqual(randomLook(7), randomLook(8));
  assert.deepEqual(LOOK_VARIABLES.map((v) => v.key).sort(), [...LOOK_SLOT_KEYS].sort());
});
