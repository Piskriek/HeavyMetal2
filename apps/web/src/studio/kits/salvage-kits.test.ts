// Plan 57 §14.2: the lab and the story stripped for parts. The lab's own kits, given their Triad sockets, are on the assembler's
// shelf, and so are the labkit's props, rebuilt as kits (relay cabinet, breaker panel, cable tray): each validates whole (grounded,
// nothing floating) and its sockets cover what its job needs. The salvage list waits empty for the next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '@hm/kitspec';
import { SALVAGE_KIT_LIST, STUDIO_KIT_LIST } from './studio-kit-registry';
import { buildStudioMachineModel } from '../viewport/build-studio-machine-model';
import { CABLE_TRAY_KIT } from '../../play/kit-cable-tray';

const SALVAGED = ['kit:gate-dais', 'kit:archway-gate', 'kit:fabricator-frame', 'kit:drone', 'kit:drone-vacuum', 'kit:game-screen', 'kit:bridge-pad', 'kit:hauler', 'kit:crawler', 'kit:relay-cabinet', 'kit:breaker-panel', 'kit:cable-tray'];

/** The roles each designed kit's sockets must cover: what plugs into it, powers it, and what it stands on or holds. */
const NEEDS: Readonly<Record<string, readonly string[]>> = {
  'kit:gate-dais': ['power', 'mount'],
  'kit:archway-gate': ['mount', 'power', 'output'],
  'kit:drone': ['input', 'power', 'mount'],
  'kit:drone-vacuum': ['input', 'power', 'output', 'mount'],
  'kit:game-screen': ['input', 'power', 'mount'],
  'kit:bridge-pad': ['power', 'mount'],
  'kit:relay-cabinet': ['power', 'mount'],
  'kit:breaker-panel': ['power', 'mount'],
  'kit:cable-tray': ['power', 'mount'],
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

test('the hung cable tray hangs from its ceiling flanges and joins end to end like the standing one', () => {
  const ceiling = { min: [-2, 0, -2] as const, max: [2, 0.2, 2] as const };
  assert.deepEqual(validate(CABLE_TRAY_KIT, 'cable-tray-hung', { ground: null, anchors: [ceiling] }), [], 'it validates against the ceiling');
  assert.ok(validate(CABLE_TRAY_KIT, 'cable-tray-hung').some((i) => i.code === 'below-ground'), 'it is not a floor kit');
  for (const preset of ['cable-tray', 'cable-tray-hung']) {
    const model = buildStudioMachineModel({ kit: CABLE_TRAY_KIT, presetId: preset, showSockets: true, stageLook: 4 });
    const names = new Set(model.socketPins.map((p) => p.socketName));
    for (const end of ['cableEndFront', 'cableEndBack']) assert.ok(names.has(end), `${preset} has its ${end}`);
    assert.ok(names.has(preset === 'cable-tray' ? 'floorMount' : 'ceilingMount'), `${preset} has its mounts`);
    model.dispose();
  }
});
