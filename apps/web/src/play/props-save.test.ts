import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PROPS_SAVE, clearedProp, parsePropsSave, readLog, sealedSite, serializePropsSave, withTrees } from './props-save';

test('a prop is cleared once: a second clear returns the same save, so a prop is never salvaged twice', () => {
  const a = clearedProp(EMPTY_PROPS_SAVE, 'crate-large-1');
  assert.deepEqual(a.cleared, ['crate-large-1']);
  const b = clearedProp(a, 'crate-large-1');
  assert.equal(b, a);
});

test('logs and sealed sites are recorded once and kept in order', () => {
  let s = readLog(EMPTY_PROPS_SAVE, 'LOG-03');
  s = readLog(s, 'LOG-01');
  s = readLog(s, 'LOG-03');
  assert.deepEqual(s.logs, ['LOG-03', 'LOG-01']);
  let t = sealedSite(EMPTY_PROPS_SAVE, 4);
  t = sealedSite(t, 1);
  t = sealedSite(t, 4);
  assert.deepEqual(t.sealed, [1, 4]);
});

test('a save round-trips through its text, and a bad or old save reads as the empty one', () => {
  const s = sealedSite(clearedProp(readLog(EMPTY_PROPS_SAVE, 'LOG-02'), 'locker'), 0);
  assert.deepEqual(parsePropsSave(serializePropsSave(s)), s);
  assert.equal(parsePropsSave(null), EMPTY_PROPS_SAVE);
  assert.equal(parsePropsSave('not json'), EMPTY_PROPS_SAVE);
  assert.equal(parsePropsSave(JSON.stringify({ v: 2, cleared: ['x'] })), EMPTY_PROPS_SAVE);
  // junk entries are dropped, duplicates merged
  const dirty = parsePropsSave(JSON.stringify({ v: 1, cleared: ['a', 'a', 7, ''], logs: [null], sealed: [3, 3, -1, 2.5, 'x'] }));
  assert.deepEqual(dirty, { v: 1, cleared: ['a'], logs: [], sealed: [3] });
});

test('kit overrides (TICKET-32) round-trip, and a malformed one is dropped, not trusted', async () => {
  const { withKitOverride } = await import('./props-save');
  const s = withKitOverride(EMPTY_PROPS_SAVE, 'capacitor-bank', ['bolts-left[0]'], { gen: 'bolt', params: { headWidth: 0.12 }, slotMaterials: { metal: 'green' }, ops: [{ op: 'chamfer-hard-edges', params: {} }], material: 'green' });
  assert.deepEqual(parsePropsSave(serializePropsSave(s)), s);
  assert.equal(serializePropsSave(EMPTY_PROPS_SAVE).includes('kits'), false, 'no kits key when there are none');
  const bad = parsePropsSave(JSON.stringify({ v: 1, cleared: [], logs: [], sealed: [], kits: { 'capacitor-bank': { 'bolts-left[0]': { params: { headWidth: 'fat' }, gen: 7 }, x: 'nope' } } }));
  assert.equal(bad.kits, undefined);
});

test('the beam\'s regrown trees round-trip by place, and junk places, species or sliders are dropped', () => {
  const oak = { species: 'oak' as const, params: { height: 12, tint: 1 } };
  const s = withTrees(EMPTY_PROPS_SAVE, ['120,-450', '-3301,77'], oak);
  const back = parsePropsSave(serializePropsSave(s));
  assert.deepEqual(back.trees, { '120,-450': oak, '-3301,77': oak });
  assert.equal(parsePropsSave(serializePropsSave(EMPTY_PROPS_SAVE)).trees, undefined, 'omitted when none');
  const junk = JSON.stringify({ v: 1, cleared: [], logs: [], sealed: [], trees: { 'x,1': oak, '1,2': { species: 'palm', params: {} }, '3,4': { species: 'pine', params: 'tall' }, '5,6': { species: 'birch', params: { height: 6 } } } });
  assert.deepEqual(parsePropsSave(junk).trees, { '5,6': { species: 'birch', params: { height: 6 } } });
});

test('a sprite card and a machine hum are part of the save, and a broken one is dropped, not trusted (plan 43)', async () => {
  const { withSpriteCard, withMachineHum } = await import('./props-save');
  const card = { name: 'Gate sprite, stage 2', kit: 'gate', stage: 2, size: 32, angles: 8, dither: 'bayer2' as const, elevationDeg: 12 };
  const hum = {
    name: 'Drill hum', role: 'machine' as const, stage: 4, gain: 0.22, loopSeconds: 0.5,
    patch: { name: 'hum', atoms: [{ wave: 'sawtooth', freqHz: 58, gain: 0.5, attackMs: 40, decayMs: 200 }] },
  };
  const s = withMachineHum(withSpriteCard(EMPTY_PROPS_SAVE, 'gate', card), 'mill-frame', hum);
  const back = parsePropsSave(serializePropsSave(s));
  assert.deepEqual(back.sprites, { gate: card });
  assert.deepEqual(back.sounds, { 'mill-frame': hum });
  assert.equal(serializePropsSave(EMPTY_PROPS_SAVE).includes('sprites'), false, 'omitted when there are none');
  // taking one down removes it
  assert.deepEqual(withSpriteCard(s, 'gate', null).sprites, {});
  assert.deepEqual(withMachineHum(s, 'mill-frame', null).sounds, {});
  // junk is dropped: an impossible turntable, an unknown wave, a name that is not a kit
  const junk = JSON.stringify({
    v: 1, cleared: [], logs: [], sealed: [],
    sprites: { gate: { ...card, angles: 99 }, 'not a kit': card },
    sounds: { mill: { ...hum, patch: { name: 'bad', atoms: [{ wave: 'vocoder', freqHz: 100, gain: 0.4, attackMs: 1, decayMs: 60 }] } } },
  });
  const parsed = parsePropsSave(junk);
  assert.equal(parsed.sprites, undefined);
  assert.equal(parsed.sounds, undefined);
});
