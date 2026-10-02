import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PLUGS, PLUG_POINTS, SHAKES, SPRITE_PRESETS, SPRITE_VARIABLES, TOOLS, addPlug, addable, changePlug, defaultPlugs, normalizePlugs, normalizeSprite, normalizeTool, plugLine, plugsFor, removePlug, shakeOffset, spriteToParams } from '../src';

test('every ready-made tool starts with its sprite and sound plugged in on use (and a swing when it changes the world)', () => {
  for (const t of TOOLS) {
    const swing = !['inspect', 'focus', 'isolate'].includes(t.action);
    assert.deepEqual(t.plugs, defaultPlugs(t.sprite, t.sound, swing ? 'swing' : undefined), t.id);
    assert.ok(SPRITE_PRESETS.some((s) => s.id === t.sprite), `${t.id} sprite ${t.sprite}`);
  }
});

test('+ attribute: every plug point is listed with the kinds that fit it, and refusals are explained', () => {
  const list = addable([]);
  assert.deepEqual(list.map((a) => a.point.on), ['use', 'opposite', 'pick', 'release']);
  assert.ok(list.find((a) => a.point.on === 'use')!.kinds.includes('shake'));
  assert.ok(!list.find((a) => a.point.on === 'pick')!.kinds.includes('shake'), 'picking a slot never shakes the view');
  let plugs = defaultPlugs('dust', 'place');
  const r = addPlug(plugs, 'release', 'shake');
  assert.equal(r.refused, undefined);
  plugs = r.plugs;
  assert.deepEqual(plugs[2], { on: 'release', kind: 'shake', ref: 'tap', amount: 1 });
  assert.equal(addPlug(plugs, 'pick', 'shake').refused, 'not-accepted');
  let full = plugs;
  while (full.length < MAX_PLUGS) full = addPlug(full, 'use', 'sound').plugs;
  assert.equal(addPlug(full, 'use', 'sound').refused, 'too-many');
  assert.deepEqual(addable(full), []);
});

test('plugs change, move and go away; what plays for a moment keeps its order', () => {
  let plugs = addPlug(defaultPlugs('dust', 'place'), 'use', 'anim', 'cheer').plugs;
  assert.deepEqual(plugsFor(plugs, 'use').map((p) => p.kind), ['sprite', 'sound', 'anim']);
  plugs = changePlug(plugs, 0, { ref: 'confetti', amount: 9 });
  assert.equal(plugs[0]!.ref, 'confetti');
  assert.equal(plugs[0]!.amount, 4, 'amount is clamped');
  plugs = changePlug(plugs, 2, { on: 'release' });
  assert.equal(plugs[2]!.on, 'release');
  plugs = removePlug(plugs, 1);
  assert.deepEqual(plugs.map((p) => p.kind), ['sprite', 'anim']);
  assert.equal(plugLine(plugs[0]!, (_k, r) => r.toUpperCase()), 'On use: sprite CONFETTI x4');
});

test('stored plugs are cleaned and a tool reads them back; older saves with one sprite and sound still work', () => {
  assert.equal(normalizePlugs('junk'), null);
  const cleaned = normalizePlugs([{ on: 'use', kind: 'sprite', ref: 'embers' }, { on: 'never', kind: 'sound', ref: 'x' }, { on: 'pick', kind: 'shake', ref: 'tap' }, null, { on: 'use', kind: 'sound', ref: '', amount: -2 }]);
  assert.deepEqual(cleaned, [{ on: 'use', kind: 'sprite', ref: 'embers', amount: 1 }, { on: 'use', kind: 'sound', ref: 'select', amount: 0 }]);
  const t = normalizeTool('dig', { plugs: [{ on: 'use', kind: 'sprite', ref: 'embers' }, { on: 'release', kind: 'shake', ref: 'thump' }] })!;
  assert.equal(t.sprite, 'embers');
  assert.equal(t.sound, 'delete', 'no sound plug: the ready-made sound stays on the card');
  assert.equal(t.plugs.length, 2);
  const old = normalizeTool('dig', { sprite: 'splash', sound: 'place' })!;
  assert.deepEqual(old.plugs, defaultPlugs('splash', 'place', 'swing'));
  assert.deepEqual(normalizeTool('inspect', {})!.plugs, defaultPlugs('pop', 'select'));
});

test('sprite presets: unique ids, values inside their own limits, edits clamped, every variable has a value', () => {
  assert.equal(new Set(SPRITE_PRESETS.map((s) => s.id)).size, SPRITE_PRESETS.length);
  for (const s of SPRITE_PRESETS) assert.deepEqual(normalizeSprite(s.id, {}), s);
  const e = normalizeSprite('pop', { count: 9999, colorA: '#ABCDEF', colorB: 'red', gravity: -500, glow: true, name: '  My pop  ' });
  assert.equal(e.count, 400);
  assert.equal(e.colorA, '#abcdef');
  assert.equal(e.colorB, normalizeSprite('pop', {}).colorB);
  assert.equal(e.gravity, -100);
  assert.equal(e.glow, true);
  assert.equal(e.name, 'My pop');
  assert.equal(normalizeSprite('nope', {}).id, 'pop');
  const params = spriteToParams(e);
  for (const v of SPRITE_VARIABLES) assert.ok(v.key in params, v.key);
});

test('a camera shake wobbles, fades out and stops', () => {
  for (const s of SHAKES) {
    assert.deepEqual(shakeOffset(s, s.ms), [0, 0, 0]);
    assert.deepEqual(shakeOffset(s, -1), [0, 0, 0]);
    const early = Math.hypot(...shakeOffset(s, s.ms * 0.05));
    const late = Math.hypot(...shakeOffset(s, s.ms * 0.9));
    assert.ok(early <= s.amp * Math.sqrt(3) + 1e-9);
    assert.ok(late < s.amp * 0.05, `${s.id} fades`);
  }
  assert.deepEqual(shakeOffset(SHAKES[0]!, 10, 0), [0, 0, 0]);
  assert.equal(PLUG_POINTS.length, 4);
});
