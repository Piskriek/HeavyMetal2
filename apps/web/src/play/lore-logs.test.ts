import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGE_LOGS, LORE, loreFor } from './lore-logs';
import { CLUTTER } from './lab-clutter';
import { TRANSPONDERS } from './wreck-sites';

test('eight readouts and eight logs, each readout two sentences and each log in its channel', () => {
  assert.equal(LORE.length, 8);
  assert.equal(Object.keys(BRIDGE_LOGS).length, 8);
  for (const e of LORE) {
    assert.ok(!/^\s/.test(e.readout), `${e.prop} readout has no stray leading space`);
    assert.match(e.readout, /^[A-Z]/, `${e.prop} readout starts with a capital`);
    assert.equal((e.readout.match(/[.!?](\s|$)/g) ?? []).length, 2, `${e.prop} readout is two sentences`);
    assert.match(BRIDGE_LOGS[e.log] ?? '', /^[A-Z][A-Z #0-9+-]+ \[T[+-]\d/, `${e.log} opens with its channel and stamp`);
  }
});

test('each lab fixture and salvage log, and each transponder, has its readout and log', () => {
  for (const c of CLUTTER) {
    if (!c.log) continue;
    assert.equal(loreFor(c.id)?.log, c.log, `${c.id} reads ${c.log}`);
  }
  for (const t of TRANSPONDERS) assert.ok(loreFor(t.id), `${t.id} has its readout`);
  assert.equal(loreFor('transponder-01')?.log, 'LOG-05');
  assert.equal(loreFor('transponder-04')?.log, 'LOG-08');
});
