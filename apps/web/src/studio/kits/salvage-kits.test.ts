// Plan 57 §14: the lab and the story stripped for parts. The lab's own kits wait on the salvage list: each one validates whole and
// builds, and none sits on the assembler's shelf until it has the Triad sockets the assembler snaps parts by.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '@hm/kitspec';
import { SALVAGE_KIT_LIST, STUDIO_KIT_LIST } from './studio-kit-registry';
import { buildStudioMachineModel } from '../viewport/build-studio-machine-model';

test('the lab\'s kits are salvaged: each validates whole (grounded, nothing floating) and builds', () => {
  assert.deepEqual(SALVAGE_KIT_LIST.map((e) => e.id), ['kit:gate-dais', 'kit:archway-gate', 'kit:fabricator-frame', 'kit:drone', 'kit:drone-vacuum', 'kit:game-screen', 'kit:hauler', 'kit:crawler']);
  for (const entry of SALVAGE_KIT_LIST) {
    assert.equal(entry.salvaged, true);
    assert.deepEqual(validate(entry.kit, entry.rootPreset), [], `${entry.id} validates whole`);
    const model = buildStudioMachineModel({ kit: entry.kit, presetId: entry.rootPreset, stageLook: 4 });
    assert.ok(model.partCount > 0 && model.triangleCount > 20, `${entry.id} builds (${model.partCount} parts, ${model.triangleCount} triangles)`);
    model.dispose();
  }
});

test('no salvaged kit sits on the assembler\'s shelf without its sockets', () => {
  const shelf = new Set(STUDIO_KIT_LIST.map((e) => e.id));
  for (const entry of SALVAGE_KIT_LIST) assert.ok(!shelf.has(entry.id), `${entry.id} waits off the shelf`);
  assert.ok(STUDIO_KIT_LIST.every((e) => !e.salvaged));
});
