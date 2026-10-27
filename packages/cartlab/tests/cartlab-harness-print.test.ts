// Plan 47 (Pillar 3): the bench prints a Sovereign Harness soul onto a blank like any other
// print, it rides the rifle only, it survives the save/load round trip, and a malformed ref
// never loads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, newLab, makeBlank, canWritePrint, startPrintWrite, canCombine, canSlot, step, loadLab, printOf, printKind,
  encodeHarnessCartridgeCode, HARNESS_SHELF_PRESETS,
  type HarnessPrintSpec, type LabEnv,
} from '../src/index';

const env = (o: Partial<LabEnv> = {}): LabEnv => ({ presets: [], stage: 1, powered: true, ...o });
const STEADFAST: HarnessPrintSpec = { name: 'Steadfast Convoy Escort (Rover)', ref: 'harness:escort-steadfast' };
const TUNED: HarnessPrintSpec = {
  name: 'Tuned Steadfast',
  ref: encodeHarnessCartridgeCode({ ...HARNESS_SHELF_PRESETS['harness:escort-steadfast']!, id: 'harness:bench-tuned', annealRateAlpha: 24.5 }),
};

test('the bench prints a shelf and a tuned harness onto blanks, and both ride the rifle only', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPrintWrite(s, env(), a, { harness: STEADFAST }), env(), RULES.writeSeconds).state;
  s = step(startPrintWrite(s, env(), b, { harness: TUNED }), env(), RULES.writeSeconds).state;
  const [ca, cb] = s.cartridges;
  assert.equal(ca!.kind, 'harness');
  assert.deepEqual(printOf(ca!), { harness: STEADFAST });
  assert.equal(printKind({ harness: TUNED }), 'harness');
  assert.ok(cb!.harness!.ref.startsWith('harnessc:'), 'a tuned soul carries the CRC-checked compact code');
  assert.match(canCombine(s, env(), [a, b]).why, /harness cartridge goes in the beam rifle/);
  assert.match(canSlot(s, a, 0).why, /harness cartridge goes in the beam rifle/);
});

test('a harness print survives the lab save/load round trip; a malformed ref never loads', () => {
  let s = makeBlank(newLab(), 100).state;
  const a = s.cartridges[0]!.id;
  s = step(startPrintWrite(s, env(), a, { harness: TUNED }), env(), RULES.writeSeconds).state;
  const loaded = loadLab(JSON.parse(JSON.stringify(s)));
  assert.ok(loaded !== null);
  assert.deepEqual(printOf(loaded.cartridges[0]!), { harness: TUNED });

  const broken = JSON.parse(JSON.stringify(s)) as { cartridges: { harness?: { name: string; ref: string } }[] };
  broken.cartridges[0]!.harness = { name: 'Evil', ref: 'javascript:alert(1)' };
  const reloaded = loadLab(broken);
  // the cartridge's malformed print is dropped on load (same rule as every other print kind)
  assert.ok(reloaded === null || reloaded.cartridges.every((c) => c.harness === undefined));
});

test('an incomplete harness cannot start printing', () => {
  const s = makeBlank(newLab(), 100).state;
  const a = s.cartridges[0]!.id;
  const bad = canWritePrint(s, env(), a, { harness: { name: '', ref: 'harness:escort-steadfast' } });
  assert.equal(bad.ok, false);
  assert.match(bad.why, /not complete/);
});
