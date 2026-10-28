// Plan 57 §14.2: the lab and the story stripped for parts. The lab's own kits, given their Triad sockets, are on the assembler's
// shelf: each validates whole (grounded, nothing floating) and its sockets cover what its job needs. The salvage list waits empty
// for the labkit's props.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '@hm/kitspec';
import { SALVAGE_KIT_LIST, STUDIO_KIT_LIST } from './studio-kit-registry';
import { buildStudioMachineModel } from '../viewport/build-studio-machine-model';

const SALVAGED = ['kit:gate-dais', 'kit:archway-gate', 'kit:fabricator-frame', 'kit:drone', 'kit:drone-vacuum', 'kit:game-screen', 'kit:bridge-pad', 'kit:hauler', 'kit:crawler'];

/** The roles each designed kit's sockets must cover: what plugs into it, powers it, and what it stands on or holds. */
const NEEDS: Readonly<Record<string, readonly string[]>> = {
  'kit:gate-dais': ['power', 'mount'],
  'kit:archway-gate': ['mount', 'power', 'output'],
  'kit:drone': ['input', 'power', 'mount'],
  'kit:drone-vacuum': ['input', 'power', 'output', 'mount'],
  'kit:game-screen': ['input', 'power', 'mount'],
  'kit:bridge-pad': ['power', 'mount'],
};

test('the lab\'s kits are on the assembler\'s shelf, and nothing waits on the salvage list', () => {
  assert.deepEqual(STUDIO_KIT_LIST.filter((e) => e.salvaged).map((e) => e.id), SALVAGED);
  assert.deepEqual(SALVAGE_KIT_LIST, []);
  assert.equal(STUDIO_KIT_LIST.filter((e) => !e.salvaged).length, 10, 'the ten machine kits are unchanged');
});

test('each salvaged kit validates whole, and its Triad sockets cover what its job needs', () => {
  for (const entry of STUDIO_KIT_LIST.filter((e) => e.salvaged)) {
    assert.deepEqual(validate(entry.kit, entry.rootPreset), [], `${entry.id} validates whole`);
    const model = buildStudioMachineModel({ kit: entry.kit, presetId: entry.rootPreset, showSockets: true, stageLook: 4 });
    const roles = new Set(model.socketPins.map((p) => p.triadRole));
    assert.ok(model.socketPins.length > 0, `${entry.id} has sockets`);
    for (const need of NEEDS[entry.id] ?? []) assert.ok(roles.has(need as never), `${entry.id} needs a ${need} socket (has ${[...roles].join(', ')})`);
    model.dispose();
  }
});
