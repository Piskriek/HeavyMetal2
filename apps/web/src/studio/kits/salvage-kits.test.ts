// Plan 57 §14.2: the lab and the story stripped for parts. The lab's own kits, given their Triad sockets, are on the assembler's
// shelf, and so are the labkit's props, rebuilt as kits (relay cabinet, breaker panel, cable tray, planet table, control box): each
// validates whole (fixed to its mount, nothing floating) and its sockets cover what its job needs. The salvage list waits empty for
// the next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '@hm/kitspec';
import { SALVAGE_KIT_LIST, STUDIO_KIT_LIST } from './studio-kit-registry';
import { CEILING_STAGE_Y, WALL_STAGE_Y, buildStudioMachineModel } from '../viewport/build-studio-machine-model';
import { CABLE_TRAY_KIT } from '../../play/kit-cable-tray';
import { CONTROL_BOX_KIT } from '../../play/kit-control-box';

const SALVAGED = ['kit:gate-dais', 'kit:archway-gate', 'kit:fabricator-frame', 'kit:drone', 'kit:drone-vacuum', 'kit:game-screen', 'kit:bridge-pad', 'kit:hauler', 'kit:crawler', 'kit:relay-cabinet', 'kit:breaker-panel', 'kit:cable-tray', 'kit:planet-table', 'kit:control-box'];

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
  'kit:planet-table': ['power', 'output', 'mount'],
  'kit:control-box': ['power', 'input', 'mount'],
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
  assert.deepEqual(validate(CABLE_TRAY_KIT, 'cable-tray-hung'), [], 'its declared ceiling holds it');
  assert.ok(validate(CABLE_TRAY_KIT, 'cable-tray-hung', { ground: 0, anchors: [] }).some((i) => i.code === 'below-ground'), 'it is not a floor kit');
  for (const preset of ['cable-tray', 'cable-tray-hung']) {
    const model = buildStudioMachineModel({ kit: CABLE_TRAY_KIT, presetId: preset, showSockets: true, stageLook: 4 });
    const names = new Set(model.socketPins.map((p) => p.socketName));
    for (const end of ['cableEndFront', 'cableEndBack']) assert.ok(names.has(end), `${preset} has its ${end}`);
    assert.ok(names.has(preset === 'cable-tray' ? 'floorMount' : 'ceilingMount'), `${preset} has its mounts`);
    model.dispose();
  }
});

test('a wall or ceiling preset stands on a ghost of its anchor in the Studio, and the ghost is never picked', () => {
  const cases = [
    { kit: CONTROL_BOX_KIT, preset: 'control-box', mount: 'wall', lift: WALL_STAGE_Y },
    { kit: CABLE_TRAY_KIT, preset: 'cable-tray-hung', mount: 'ceiling', lift: CEILING_STAGE_Y },
    { kit: CABLE_TRAY_KIT, preset: 'cable-tray', mount: 'floor', lift: 0 },
  ] as const;
  for (const c of cases) {
    const model = buildStudioMachineModel({ kit: c.kit, presetId: c.preset, stageLook: 4 });
    assert.equal(model.mount, c.mount, c.preset);
    assert.equal(model.stageLift, c.lift, `${c.preset} stands at its mount's height`);
    const ghost = model.group.children.find((o) => o.name.startsWith('studio-mount-ghost'));
    assert.equal(ghost !== undefined, c.mount !== 'floor', `${c.preset} has a ghost only when it is fixed to a wall or ceiling`);
    if (ghost) {
      assert.equal(ghost.userData['isHelper'], true);
      for (const o of ghost.children) assert.equal(o.userData['isHelper'], true, 'every piece of the ghost is a helper');
    }
    // nothing it holds hangs below the floor it is staged over
    assert.ok(model.bounds.min[1] + model.stageLift >= 0, `${c.preset} is above the floor`);
    model.dispose();
  }
});
