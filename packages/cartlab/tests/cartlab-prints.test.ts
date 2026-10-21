import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, newLab, makeBlank, canWritePrint, startPrintWrite, canCombine, canSlot, step, loadLab, printOf, type LabEnv, type LightSpec, type SpeciesSpec } from '../src/index';

const env = (o: Partial<LabEnv> = {}): LabEnv => ({ presets: [], stage: 1, powered: true, ...o });
const AUTUMN_OAK: SpeciesSpec = { name: 'Autumn oak', species: 'oak', params: { height: 9, tint: 1 } };
const SODIUM: LightSpec = { name: 'Sodium amber', kelvin: 2000, colour: null, intensity: 1.2, pattern: 'steady' };

test('the bench prints a species and a light onto blanks, like a part', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPrintWrite(s, env(), a, { species: AUTUMN_OAK }), env(), RULES.writeSeconds).state;
  assert.equal(canWritePrint(s, env({ powered: false }), b, { light: SODIUM }).ok, false, 'the bench needs the gate');
  s = step(startPrintWrite(s, env(), b, { light: SODIUM }), env(), RULES.writeSeconds).state;
  const [ca, cb] = s.cartridges;
  assert.equal(ca!.kind, 'species');
  assert.deepEqual(ca!.species, AUTUMN_OAK);
  assert.equal(ca!.name, 'Autumn oak');
  assert.equal(cb!.kind, 'light');
  assert.deepEqual(printOf(cb!), { light: SODIUM });
});

test('species and light cartridges go in the beam rifle only', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPrintWrite(s, env(), a, { species: AUTUMN_OAK }), env(), RULES.writeSeconds).state;
  s = step(startPrintWrite(s, env(), b, { light: SODIUM }), env(), RULES.writeSeconds).state;
  assert.match(canCombine(s, env(), [a, b]).why, /species cartridge goes in the beam rifle/);
  assert.match(canSlot(s, b, 0).why, /light cartridge goes in the beam rifle/);
});

test('a malformed light or species is refused, and saves keep only well formed prints', () => {
  const s0 = makeBlank(newLab(), 100).state;
  const a = s0.cartridges[0]!.id;
  assert.equal(canWritePrint(s0, env(), a, { light: { ...SODIUM, kelvin: 99999 } }).ok, false);
  assert.equal(canWritePrint(s0, env(), a, { light: { ...SODIUM, colour: 'red' } }).ok, false);
  assert.equal(canWritePrint(s0, env(), a, { species: { ...AUTUMN_OAK, species: '' } }).ok, false);
  let s = startPrintWrite(s0, env(), a, { light: { ...SODIUM, colour: '#ff3d8a', pattern: 'blink' } });
  s = step(s, env({ powered: false }), 1).state;
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(s))), s, 'a paused light job survives a save');
  s = step(s, env(), RULES.writeSeconds).state;
  const saved = JSON.parse(JSON.stringify(s));
  assert.deepEqual(loadLab(saved), s);
  saved.cartridges[0].light.pattern = 'disco';
  assert.equal(loadLab(saved), null, 'an unknown pattern is junk');
  const both = JSON.parse(JSON.stringify(s));
  both.cartridges[0].species = AUTUMN_OAK;
  assert.equal(loadLab(both), null, 'one print per cartridge');
});

test('the bench prints a layered material by name; it goes in the rifle only, and a malformed name is refused (plan 41)', () => {
  const RUST = { name: 'Rust bucket', ref: 'mat:rust-bucket' };
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPrintWrite(s, env(), a, { material: RUST }), env(), RULES.writeSeconds).state;
  const c = s.cartridges[0]!;
  assert.equal(c.kind, 'material');
  assert.equal(c.name, 'Rust bucket');
  assert.deepEqual(printOf(c), { material: RUST });
  assert.match(canSlot(s, a, 0).why, /material cartridge goes in the beam rifle/);
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(s))), s, 'a material cartridge survives a save');
  for (const ref of ['vault:basalt', 'mat:', 'matc:has spaces', 'mat:x'.padEnd(5000, 'x')]) {
    assert.equal(canWritePrint(s, env(), b, { material: { name: 'Bad', ref } }).ok, false, ref.slice(0, 20));
  }
  assert.equal(canWritePrint(s, env(), b, { material: { name: 'Mine', ref: 'matc:t7Ax_-9' } }).ok, true);
});
