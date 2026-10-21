import test from 'node:test';
import assert from 'node:assert/strict';
import type { PartSpec, Print } from '@hm/cartlab';
import { EMPTY_MY_PRESETS, forgetPreset, parseMyPresets, presetsOf, readShareCode, renamePreset, savePreset, serializeMyPresets, shareCode } from './my-presets';

const BOLT_PART: PartSpec = { name: 'Fat green bolt', gen: 'bolt', params: { headWidth: 0.12 }, slotMaterials: { metal: 'green' }, ops: [] };
const BOLT: Print = { part: BOLT_PART };
const OAK: Print = { species: { name: 'Autumn oak', species: 'oak', params: { height: 11, tint: 1 } } };
const STROBE: Print = { light: { name: 'Hazard strobe', kelvin: 4000, colour: '#ffb02a', intensity: 2, pattern: 'blink' } };

test('presets save under their own names, by kind, and survive the profile round trip', () => {
  let s = EMPTY_MY_PRESETS;
  for (const p of [BOLT, OAK, STROBE]) s = savePreset(s, p).presets;
  assert.deepEqual(s.list.map((q) => [q.id, q.kind, q.name]), [['my1', 'part', 'Fat green bolt'], ['my2', 'species', 'Autumn oak'], ['my3', 'light', 'Hazard strobe']]);
  assert.deepEqual(presetsOf(s, 'species').map((q) => q.name), ['Autumn oak']);
  assert.deepEqual(parseMyPresets(serializeMyPresets(s)), s);
});

test('the same preset is kept once, even under another name; any real difference is a new preset', () => {
  let s = savePreset(EMPTY_MY_PRESETS, BOLT).presets;
  const again = savePreset(s, { part: { ...BOLT_PART, name: 'Another name' } });
  assert.equal(again.presets, s, 'nothing added');
  assert.equal(again.preset.id, 'my1');
  s = savePreset(s, { part: { ...BOLT_PART, params: { headWidth: 0.13 } } }).presets;
  assert.equal(s.list.length, 2, 'a slider value apart is another preset');
});

test('renaming renames the print too; forgetting removes it; ids never come back', () => {
  let s = savePreset(savePreset(EMPTY_MY_PRESETS, BOLT).presets, OAK).presets;
  s = renamePreset(s, 'my2', '  Copper grove  ');
  assert.equal(s.list[1]!.name, 'Copper grove');
  assert.equal((s.list[1]!.print as { species: { name: string } }).species.name, 'Copper grove');
  s = forgetPreset(s, 'my1');
  s = savePreset(s, STROBE).presets;
  assert.deepEqual(s.list.map((q) => q.id), ['my2', 'my3']);
  assert.equal(parseMyPresets(serializeMyPresets(s)).next, 4);
});

test('a broken saved preset is dropped, not trusted; junk text is the empty library', () => {
  const s = savePreset(EMPTY_MY_PRESETS, OAK).presets;
  const raw = JSON.parse(serializeMyPresets(s));
  raw.list.push({ id: 'my9', name: 'Bad light', print: { light: { name: 'x', kelvin: 99999, colour: null, intensity: 1, pattern: 'steady' } } });
  raw.list.push({ id: '../x', name: 'Bad id', print: OAK });
  assert.deepEqual(parseMyPresets(JSON.stringify(raw)).list.map((q) => q.id), ['my1']);
  assert.deepEqual(parseMyPresets('not json'), EMPTY_MY_PRESETS);
  assert.deepEqual(parseMyPresets(null), EMPTY_MY_PRESETS);
});

test('a share code carries one preset, kind and all, and refuses anything else', () => {
  for (const p of [BOLT, OAK, STROBE]) {
    const code = shareCode(p);
    assert.match(code, /^SMX-(PRT|SPC|LGT)-[A-Za-z0-9_-]+$/);
    assert.deepEqual(readShareCode(`  ${code} `), p);
  }
  const oakCode = shareCode(OAK);
  assert.equal(readShareCode(oakCode.replace('SMX-SPC-', 'SMX-LGT-')), null, 'the prefix must match the kind inside');
  assert.equal(readShareCode('SMX-PLN-0001-MOON'), null, 'a planet code is not a preset');
  assert.equal(readShareCode(oakCode.slice(0, -6)), null, 'a cut code is junk');
});
