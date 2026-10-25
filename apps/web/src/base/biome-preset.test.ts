import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIOME_SPECIES,
  EARTH_BIOME_PRESET,
  MOON_BIOME_PRESET,
  PLOT_BIOME_PRESETS,
  PLOT_BIOME_SLOTS,
  biomePresetFor,
  biomeSlotShares,
  biomeSlotSpecies,
  earthPlotUnlock,
  readBiomePreset,
  withBiomeSlot,
} from './biome-preset';

test('both shipped presets hold exactly six treegen species slots and a palette material', () => {
  for (const preset of [MOON_BIOME_PRESET, EARTH_BIOME_PRESET]) {
    assert.equal(preset.v, 1);
    assert.equal(preset.species.length, PLOT_BIOME_SLOTS);
    for (const s of preset.species) {
      assert.ok(BIOME_SPECIES.includes(s.species));
      assert.ok(Object.keys(s.params).length > 0, `${s.species} carries sliders`);
      assert.ok(s.share > 0 && s.share <= 1);
    }
    // the ground is a layered material from the shelf, the sky a light cartridge
    assert.match(preset.terrain.material, /^mat:[a-z-]+$/);
    assert.ok(preset.terrain.age >= 0 && preset.terrain.age <= 1);
    assert.ok(preset.terrain.cover >= 0 && preset.terrain.cover <= 1);
    assert.match(preset.sky.lamp, /^lx:\d{4}:\d+(\.\d+)?:(steady|pulse|flicker)$/);
    assert.ok(preset.sky.sunKelvin >= 1000 && preset.sky.sunKelvin <= 20000);
    assert.match(preset.sky.horizon, /^#[0-9a-f]{6}$/i);
  }
  // the Earth preset is the living one: more cover, a warmer sun, taller trees
  assert.ok(EARTH_BIOME_PRESET.terrain.cover > MOON_BIOME_PRESET.terrain.cover);
  assert.ok(EARTH_BIOME_PRESET.sky.sunKelvin < MOON_BIOME_PRESET.sky.sunKelvin);
  const tallest = (p: typeof EARTH_BIOME_PRESET) => Math.max(...p.species.map((s) => s.params.height ?? 0));
  assert.ok(tallest(EARTH_BIOME_PRESET) > tallest(MOON_BIOME_PRESET));
  assert.notEqual(EARTH_BIOME_PRESET.id, MOON_BIOME_PRESET.id);
  assert.deepEqual(PLOT_BIOME_PRESETS.moon, MOON_BIOME_PRESET);
  assert.deepEqual(PLOT_BIOME_PRESETS.earth, EARTH_BIOME_PRESET);
  assert.equal(biomePresetFor('earth').world, 'earth');
  assert.equal(biomePresetFor('moon').world, 'moon');
});

test('Earth opens at Stage 6 with the four Cardinal Floats settled, and not a stage before', () => {
  const settled = { pxd: 1, vtx: 1, lx: 1, aq: 1 };
  const levels = { pxd: 100, vtx: 100, lx: 100, aq: 100 };
  assert.equal(earthPlotUnlock(6, settled).unlocked, true);
  assert.equal(earthPlotUnlock(6, levels).unlocked, true);
  assert.equal(earthPlotUnlock(7, settled).unlocked, true);
  for (const stage of [0, 1, 2, 3, 4, 5]) {
    const r = earthPlotUnlock(stage, settled);
    assert.equal(r.unlocked, false, `stage ${stage}`);
    assert.match(r.reason, /Stage 6/);
    assert.ok(r.reason.includes(String(stage)), `the reason names the stage the player is on: ${r.reason}`);
  }
  // Stage 6 with one float behind is still locked, and says so
  const short = earthPlotUnlock(6, { pxd: 1, vtx: 1, lx: 1, aq: 0.4 });
  assert.equal(short.unlocked, false);
  // no cardinals at all keeps the stage-only reading the game has always used
  assert.equal(earthPlotUnlock(6).unlocked, true);
  assert.equal(earthPlotUnlock(5).unlocked, false);
});

test('a species slot is the owner\'s to retune, and the preset stays at six slots', () => {
  const retuned = withBiomeSlot(EARTH_BIOME_PRESET, 0, { species: 'birch', params: { height: 15, tint: 1 }, share: 0.5 });
  assert.equal(retuned.species.length, PLOT_BIOME_SLOTS);
  const first = retuned.species[0]!;
  assert.equal(first.species, 'birch');
  assert.equal(first.params.height, 15);
  assert.equal(first.share, 0.5);
  // the other slots are untouched, and the original preset is not mutated
  assert.deepEqual(retuned.species[1], EARTH_BIOME_PRESET.species[1]);
  assert.equal(EARTH_BIOME_PRESET.species[0]!.species, 'oak');
  // an index wraps into the six slots rather than throwing
  assert.deepEqual(withBiomeSlot(EARTH_BIOME_PRESET, 6, { share: 0.11 }).species[0]!.share, 0.11);
  assert.deepEqual(withBiomeSlot(EARTH_BIOME_PRESET, -1, { share: 0.12 }).species[5]!.share, 0.12);
  // an unknown species or a wild share cannot get in
  assert.equal(withBiomeSlot(EARTH_BIOME_PRESET, 0, { species: 'fern' as never }).species[0]!.species, 'oak');
  assert.equal(withBiomeSlot(EARTH_BIOME_PRESET, 0, { share: 99 }).species[0]!.share, 1);
  // the shares are normalised for the scatter, and an all-zero palette still spreads evenly
  const shares = biomeSlotShares(retuned);
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const zero = { ...EARTH_BIOME_PRESET, species: EARTH_BIOME_PRESET.species.map((s) => ({ ...s, share: 0 })) };
  assert.ok(biomeSlotShares(zero).every((s) => Math.abs(s - 1 / PLOT_BIOME_SLOTS) < 1e-9));
  assert.deepEqual(biomeSlotSpecies(MOON_BIOME_PRESET).length, PLOT_BIOME_SLOTS);
});

test('a preset reads back from a save, and a damaged one reads as nothing at all', () => {
  for (const preset of [MOON_BIOME_PRESET, EARTH_BIOME_PRESET]) {
    const back = readBiomePreset(JSON.parse(JSON.stringify(preset)));
    assert.deepEqual(back, preset);
  }
  const retuned = withBiomeSlot(EARTH_BIOME_PRESET, 2, { species: 'pine', params: { height: 16, crownSpread: 1.4 } });
  assert.deepEqual(readBiomePreset(JSON.parse(JSON.stringify(retuned))), retuned);
  // not a preset
  for (const junk of [null, undefined, 42, 'earth', [], {}, { terrain: {}, sky: {} }]) {
    assert.equal(readBiomePreset(junk), null, `${JSON.stringify(junk)}`);
  }
  const good = JSON.parse(JSON.stringify(EARTH_BIOME_PRESET));
  // a hostile or corrupt field falls back instead of throwing: five slots, a wrong material, a wild sun
  const shortSlots = { ...good, species: good.species.slice(0, 5) };
  assert.equal(readBiomePreset(shortSlots), null);
  const badMaterial = { ...good, terrain: { ...good.terrain, material: 'javascript:alert(1)' } };
  assert.equal(readBiomePreset(badMaterial), null);
  const badSky = { ...good, sky: { ...good.sky, lamp: 'lamp' } };
  assert.equal(readBiomePreset(badSky), null);
  const clamped = readBiomePreset({ ...good, sky: { ...good.sky, sunKelvin: 99999, fog: -3 }, terrain: { ...good.terrain, age: 7 } });
  assert.ok(clamped);
  assert.equal(clamped!.sky.sunKelvin, 20000);
  assert.equal(clamped!.sky.fog, 0);
  assert.equal(clamped!.terrain.age, 1);
  // a species slot of an unknown species is dropped, which fails the six-slot rule rather than growing a fern
  const fern = { ...good, species: [good.species[0], good.species[1], good.species[2], good.species[3], good.species[4], { species: 'fern', params: {}, share: 0.2 }] };
  assert.equal(readBiomePreset(fern), null);
  // an unknown world reads as the Moon's, and a nameless preset is 'custom'
  const odd = readBiomePreset({ ...good, world: 'mars', id: 'NOT A SLUG' });
  assert.ok(odd);
  assert.equal(odd!.world, 'moon');
  assert.equal(odd!.id, 'custom');
});
