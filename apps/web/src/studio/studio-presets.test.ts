import test from 'node:test';
import assert from 'node:assert/strict';
import { presetsFrom, type PresetSource } from './studio-presets';

const specs: PresetSource[] = [
  { id: 'lunar', name: 'Lunar Anorthosite', cls: 'MATERIAL', pal: ['#1b1d22', '#3a3f48', '#6b7280', '#a7aeb8'], tags: ['grey'], p: { roughLo: 0.76, roughHi: 0.97 } },
  { id: 'pyrite', name: 'Iron Pyrite Strata', cls: 'MATERIAL', pal: ['#1a1509', '#564419', '#a98a2e'], tags: ['pyrite', 'metallic'], p: { roughLo: 0.18, roughHi: 0.52 } },
  { id: 'shock', name: 'Impact Shock Quartz', cls: 'MATERIAL', pal: ['#111111', '#222222', '#9aa8c6'], tags: ['quartz'] },
  { id: 'biome', name: 'A Biome', cls: 'BIOME', pal: ['#000000', '#111111', '#222222'], tags: [] },
  { id: 'empty', name: 'No palette', cls: 'MATERIAL', pal: [], tags: [] },
];

test('only MATERIAL cartridges with a palette become presets, in order', () => {
  const out = presetsFrom(specs);
  assert.deepEqual(out.map((p) => p.name), ['Lunar Anorthosite', 'Iron Pyrite Strata', 'Impact Shock Quartz']);
});

test('the tint is the cartridge palette middle stop (the vault builds its tint from it)', () => {
  const [lunar, pyrite] = presetsFrom(specs);
  assert.equal(lunar?.tint, '#6b7280');
  assert.equal(pyrite?.tint, '#a98a2e');
});

test('metal is set only by the metallic tag; rough is the middle of the authored range', () => {
  const [lunar, pyrite] = presetsFrom(specs);
  assert.equal(lunar?.metalness, 0);
  assert.equal(pyrite?.metalness, 0.85);
  assert.equal(lunar?.roughness, 0.87);
  assert.equal(pyrite?.roughness, 0.35);
});

test('a cartridge with no roughness range gets the default rough, and a one-stop palette still has a tint', () => {
  const shock = presetsFrom(specs)[2];
  assert.equal(shock?.roughness, 0.6);
  assert.equal(shock?.tint, '#9aa8c6');
  const one = presetsFrom([{ id: 'x', name: 'One', cls: 'MATERIAL', pal: ['#abcdef'], tags: [] }]);
  assert.equal(one[0]?.tint, '#abcdef');
});
