// ============================================================================
// File: apps/web/src/play/kit-machines.test.ts
// JOB-08 (TICKET-40 Phase 2): the eleven machines are 100% @hm/partgen geometry on @hm/kitspec sockets, decomposed into
// the five functional groups, and they pass the anatomy standard's gate: 0 loose ends, 0 collision violations, 0
// unterminated ends, every control reachable.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAVY_KINDS, MACHINE_KINDS, type MachineKind } from '@hm/plotsim';
import { flatten, presetSockets, validate } from '@hm/kitspec';
import { MACHINE_BLUEPRINT, MACHINE_KITS, MACHINE_KIT_SPECS, MACHINE_MATERIALS, MACHINE_PRESET, machineKit } from './kit-machines';
import { KIT_GROUPS, auditKitGroups, kitGroups } from './kit-groups';
import { auditSummary, kitAudit } from '../studio/studio-agent-audit';

const ALL_KINDS: readonly MachineKind[] = [...MACHINE_KINDS, ...HEAVY_KINDS];
/** The kinds the plot drops ore into (ARGO_NOTE_16 ruling 3): they carry a `feed` socket, the others carry none. */
const FEEDS: readonly MachineKind[] = ['mill', 'heavy-mill', 'press', 'heavy-press', 'water', 'heavy-water'];
/** The kinds whose part moves while it runs (the plot's own motion table). */
const MOVERS: readonly MachineKind[] = ['drill', 'press', 'heavy-press', 'projector', 'heavy-projector'];

test('every machine kind has a kit spec, and the eleven specs are the eleven kinds', () => {
  assert.equal(ALL_KINDS.length, 11);
  assert.deepEqual(Object.keys(MACHINE_KIT_SPECS).sort(), [...ALL_KINDS].sort());
  for (const kind of ALL_KINDS) {
    const spec = MACHINE_KIT_SPECS[kind];
    assert.equal(spec.kind, kind);
    assert.equal(spec.prefix, kind, `${kind}: the prefix namespaces its part ids`);
    assert.equal(spec.feed, FEEDS.includes(kind), `${kind}: feed`);
    assert.equal(spec.motion !== null, MOVERS.includes(kind), `${kind}: motion`);
  }
});

test('a machine is 100% partgen geometry: no part is a generated model, and every part is a param or a box', () => {
  for (const kind of ALL_KINDS) {
    const kit = MACHINE_KITS[kind];
    for (const [id, def] of Object.entries(kit.parts)) {
      assert.notEqual(def.source.kind, 'gen', `${kind}/${id}: a machine part is never a .glb`);
      assert.ok(def.source.kind === 'param' || def.source.kind === 'box', `${kind}/${id}: ${def.source.kind}`);
      assert.ok(id.startsWith(`${MACHINE_KIT_SPECS[kind].prefix}-`), `${kind}/${id}: ids are namespaced by the machine`);
    }
  }
});

test('a machine is one preset of five group assemblies, and the groups are the anatomy standard’s five', () => {
  for (const kind of ALL_KINDS) {
    const kit = MACHINE_KITS[kind];
    assert.deepEqual(Object.keys(kit.assemblies).filter((a) => a !== MACHINE_PRESET).sort(), [...KIT_GROUPS].sort(), `${kind} assemblies`);
    const top = kit.assemblies[MACHINE_PRESET];
    assert.ok(top, `${kind} has its preset`);
    // the preset places the four mounted groups on the base by name, so the decomposition is structural, not a label
    const mounted = (top?.children ?? []).filter((c) => c.on).map((c) => c.ref);
    assert.deepEqual(mounted.sort(), ['controls', 'mechanism', 'structure', 'subject'], `${kind} mounts`);
  }
});

test('every machine carries 25 to 45 parts in exactly five groups, with nothing ungrouped', () => {
  for (const kind of ALL_KINDS) {
    const kit = MACHINE_KITS[kind];
    const placed = flatten(kit, MACHINE_PRESET);
    assert.ok(placed.length >= 25 && placed.length <= 45, `${kind}: ${placed.length} parts`);
    const audit = auditKitGroups(kit, MACHINE_PRESET, placed);
    assert.equal(audit.ok, true, `${kind}: ${audit.why.join('; ')}`);
    for (const g of KIT_GROUPS) {
      assert.ok(audit.report.counts[g] > 0, `${kind}: group ${g} is empty`);
    }
  }
});

test('every machine is legal (validate: 0 problems) and every part is reachable from the pad it stands on', () => {
  for (const kind of ALL_KINDS) {
    const issues = validate(MACHINE_KITS[kind], MACHINE_PRESET);
    assert.deepEqual(issues, [], `${kind}: ${JSON.stringify(issues)}`);
  }
});

test('the anatomy gate passes for all eleven machines: 0 loose ends, 0 collisions, 0 unterminated ends, every control reachable', () => {
  for (const kind of ALL_KINDS) {
    const report = kitAudit(MACHINE_KITS[kind], { preset: MACHINE_PRESET });
    assert.equal(report.ok, true, `${kind}: ${auditSummary(report)} — ${JSON.stringify(report.solidClearances.slice(0, 4))}`);
    assert.equal(report.looseEnds, 0, `${kind}: ${JSON.stringify(report.loose.slice(0, 3))}`);
    assert.equal(report.terminals, 0, `${kind}: ${JSON.stringify(report.terminalIssues.slice(0, 3))}`);
    assert.equal(report.hingeBendRadius.ok, true, `${kind}: ${JSON.stringify(report.hingeBendRadius.failures)}`);
    assert.equal(report.orbitClearance24.ok, true, `${kind}: ${JSON.stringify(report.orbitClearance24.failures)}`);
    // the machine's controls are what a cartridge aims at, so the target set is never empty
    assert.ok(report.orbitClearance24.targets >= 5, `${kind}: ${report.orbitClearance24.targets} targets`);
    // and the parts that move are the plot's own movers
    assert.equal(report.moving.length, MOVERS.includes(kind) ? 1 : 0, `${kind}: moving ${JSON.stringify(report.moving)}`);
  }
});

test('the preset declares the sockets the plot hangs its telemetry on, and the feed only where ore goes in', () => {
  for (const kind of ALL_KINDS) {
    const sockets = presetSockets(MACHINE_KITS[kind], MACHINE_PRESET);
    for (const name of ['power', 'vent', 'top', 'statusLed', 'emit']) assert.ok(sockets[name], `${kind}: socket ${name}`);
    assert.equal(Boolean(sockets.feed), FEEDS.includes(kind), `${kind}: feed socket`);
    // every socket sits inside the machine's own envelope, so nothing hangs in the air above the frame
    const placed = flatten(MACHINE_KITS[kind], MACHINE_PRESET);
    assert.ok(placed.length > 0);
    for (const [name, s] of Object.entries(sockets)) {
      assert.ok(s.at[1] >= 0 && s.at[1] <= MACHINE_BLUEPRINT.height + 0.2, `${kind}/${name}: y ${s.at[1].toFixed(3)}`);
    }
  }
});

test('the parts are hung on declared sockets, not on hand-written positions: each group is placed on the one before it', () => {
  for (const kind of ALL_KINDS) {
    const kit = MACHINE_KITS[kind];
    const top = kit.assemblies[MACHINE_PRESET];
    const base = top?.children[0];
    assert.equal(base?.key ?? base?.ref, 'base', `${kind}: the base is placed first`);
    for (const child of top?.children ?? []) {
      if (child.ref === 'base') continue;
      assert.equal(child.on?.child, 0, `${kind}/${child.ref}: mounted on the base`);
      assert.ok(child.on?.socket, `${kind}/${child.ref}: on a named socket`);
    }
  }
});

test('the materials a machine draws with are the plot palette’s, and the two light cartridges are lx:', () => {
  assert.equal(MACHINE_MATERIALS.lamp.startsWith('lx:'), true);
  assert.equal(MACHINE_MATERIALS.emit.startsWith('lx:'), true);
  assert.ok(MACHINE_MATERIALS.ore.startsWith('mat:'));
  assert.ok(MACHINE_MATERIALS.grille.startsWith('mat:'));
  for (const kind of ALL_KINDS) {
    for (const def of Object.values(MACHINE_KITS[kind].parts)) {
      assert.ok(/^(khaki-paint|hull-steel|accent-hardware|hopper-slate|mat:|lx:)/.test(def.material), `${kind}: ${def.material}`);
    }
  }
});

test('machineKit(spec) is deterministic: two builds of a spec give the same kit, and the frozen table holds those kits', () => {
  for (const kind of ALL_KINDS) {
    const spec = MACHINE_KIT_SPECS[kind];
    assert.equal(JSON.stringify(machineKit(spec)), JSON.stringify(machineKit(spec)), `${kind} is deterministic`);
    assert.equal(JSON.stringify(MACHINE_KITS[kind]), JSON.stringify(machineKit(spec)), `${kind} is the frozen build`);
  }
  assert.equal(Object.isFrozen(MACHINE_KITS), true);
});

test('a ram’s stroke is sized to the frame it hangs in, so the heavies cannot drive their piston into the motor', () => {
  for (const kind of MOVERS) {
    const kit = MACHINE_KITS[kind];
    const ram = flatten(kit, MACHINE_PRESET).find((p) => kit.parts[p.part]?.motion?.kind === 'reciprocate');
    if (!ram) continue;
    const motion = kit.parts[ram.part]?.motion;
    assert.ok(motion && motion.amplitude <= 0.38, `${kind}: amplitude ${motion?.amplitude}`);
  }
});

test('the five-group report names what a cartridge menu lists, group by group', () => {
  const report = kitGroups(MACHINE_KITS.mill, MACHINE_PRESET);
  assert.equal(report.missing.length, 0);
  assert.deepEqual(report.ungrouped, []);
  assert.ok(report.groups.controls.some((p) => p.endsWith('/cartridge-port-a')));
  assert.ok(report.groups.subject.some((p) => p.endsWith('/subject-hopper')));
  assert.ok(report.groups.mechanism.some((p) => p.endsWith('/drive-motor')));
  assert.ok(report.groups.base.some((p) => p.endsWith('/skid')));
  assert.ok(report.groups.structure.some((p) => p.endsWith('/crown')));
});
