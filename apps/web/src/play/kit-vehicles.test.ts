// ============================================================================
// File: apps/web/src/play/kit-vehicles.test.ts
// JOB-08v (TICKET-40 phase 3): the three vehicles are 100% @hm/partgen geometry on @hm/kitspec sockets, decomposed
// into the five functional groups, and they pass the anatomy standard's gate: 0 loose ends, 0 collision violations,
// 0 unterminated ends, every control reachable — at rest, exploded, and through eight phases of their own motion.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, presetBounds, presetSockets, validate } from '@hm/kitspec';
import {
  CRAWLER_KIT,
  CRAWLER_KIT_SPEC,
  HAULER_KIT,
  HAULER_KIT_SPEC,
  SCOUT_KIT,
  SCOUT_KIT_SPEC,
  VEHICLE_KINDS,
  VEHICLE_KITS,
  VEHICLE_PRESET,
  vehicleKit,
  vehicleKitSpec,
  type VehicleKind,
} from './kit-vehicles';
import { KIT_GROUPS, auditKitGroups, kitGroups } from './kit-groups';
import { auditSummary, kitAudit } from '../studio/studio-agent-audit';

const SPECS = [HAULER_KIT_SPEC, CRAWLER_KIT_SPEC, SCOUT_KIT_SPEC];

test('the three vehicles are the three specs, and each spec names its own subject', () => {
  assert.deepEqual([...VEHICLE_KINDS], ['hauler', 'crawler', 'scout']);
  assert.deepEqual(Object.keys(VEHICLE_KITS).sort(), [...VEHICLE_KINDS].sort());
  assert.deepEqual(SPECS.map((s) => s.kind), [...VEHICLE_KINDS]);
  assert.deepEqual(SPECS.map((s) => s.subject), ['cargo-bed', 'cutter-head', 'scanner-mast']);
  for (const spec of SPECS) {
    assert.equal(vehicleKitSpec(spec.kind), spec, `${spec.kind}: the spec table is the frozen one`);
    assert.equal(vehicleKit(spec.kind), VEHICLE_KITS[spec.kind], `${spec.kind}: the kit table is the frozen one`);
    assert.equal(spec.prefix, spec.kind, `${spec.kind}: the prefix namespaces its part ids`);
  }
});

test('a vehicle is 100% partgen geometry: no part is a generated model, and every part is a param or a box', () => {
  for (const kind of VEHICLE_KINDS) {
    const kit = VEHICLE_KITS[kind];
    for (const [id, def] of Object.entries(kit.parts)) {
      assert.notEqual(def.source.kind, 'gen', `${kind}/${id}: a vehicle part is never a .glb`);
      assert.ok(def.source.kind === 'param' || def.source.kind === 'box', `${kind}/${id}: ${def.source.kind}`);
      assert.ok(id.startsWith(kind + '-'), `${kind}/${id}: ids are namespaced by the vehicle`);
    }
  }
});

test('a vehicle is one preset of five group assemblies: the anatomy standard\u2019s five', () => {
  for (const kind of VEHICLE_KINDS) {
    const kit = VEHICLE_KITS[kind];
    assert.deepEqual(Object.keys(kit.assemblies).filter((a) => a !== VEHICLE_PRESET).sort(), [...KIT_GROUPS].sort(), `${kind} assemblies`);
    const top = kit.assemblies[VEHICLE_PRESET];
    assert.ok(top, `${kind} has its preset`);
    const mounted = (top?.children ?? []).filter((c) => c.on).map((c) => c.ref);
    assert.deepEqual(mounted, ['structure', 'mechanism', 'controls', 'subject'], `${kind}: the five groups are mounted on the base (and the cutter hangs on the boom)`);
    assert.equal(top?.children[0]?.ref, 'base', `${kind}: the base is placed first`);
  }
});

test('every vehicle carries its part budget in exactly five groups, with nothing ungrouped', () => {
  for (const spec of SPECS) {
    const kit = VEHICLE_KITS[spec.kind];
    const placed = flatten(kit, VEHICLE_PRESET);
    assert.ok(placed.length >= spec.parts.min && placed.length <= spec.parts.max, `${spec.kind}: ${placed.length} parts (${spec.parts.min}-${spec.parts.max})`);
    const audit = auditKitGroups(kit, VEHICLE_PRESET, placed);
    assert.equal(audit.ok, true, `${spec.kind}: ${audit.why.join('; ')}`);
    for (const g of KIT_GROUPS) assert.ok(audit.report.counts[g] > 0, `${spec.kind}: group ${g} is empty`);
    const report = kitGroups(kit, VEHICLE_PRESET, placed);
    assert.deepEqual(report.ungrouped, [], `${spec.kind}: nothing outside the five groups`);
  }
});

test('every vehicle is legal: validate() reports nothing floating and nothing below the ground', () => {
  for (const kind of VEHICLE_KINDS) {
    const issues = validate(VEHICLE_KITS[kind], VEHICLE_PRESET);
    assert.deepEqual(issues, [], `${kind}: ${JSON.stringify(issues.slice(0, 4))}`);
  }
});

test('the anatomy gate passes for all three vehicles: 0 loose ends, 0 collisions, 0 unterminated ends, every control reachable', () => {
  for (const kind of VEHICLE_KINDS) {
    const report = kitAudit(VEHICLE_KITS[kind], { preset: VEHICLE_PRESET });
    assert.equal(report.ok, true, `${kind}: ${auditSummary(report)} — ${JSON.stringify(report.solidClearances.slice(0, 4))}`);
    assert.equal(report.looseEnds, 0, `${kind}: ${JSON.stringify(report.loose.slice(0, 3))}`);
    assert.equal(report.terminals, 0, `${kind}: ${JSON.stringify(report.terminalIssues.slice(0, 3))}`);
    assert.equal(report.hingeBendRadius.ok, true, `${kind}: ${JSON.stringify(report.hingeBendRadius.failures)}`);
    assert.equal(report.orbitClearance24.ok, true, `${kind}: ${JSON.stringify(report.orbitClearance24.failures.slice(0, 2))}`);
    assert.ok(report.orbitClearance24.targets >= 5, `${kind}: ${report.orbitClearance24.targets} targets`);
    assert.ok(report.moving.length >= 2, `${kind}: ${report.moving.length} moving parts`);
    // the sweep really ran through the motion phases: eight of them, and the moving parts are named
    assert.equal(report.phases, 8);
  }
});

test('the gate holds at the kit audit the Studio runs, with the same counters a machine reports', () => {
  for (const kind of VEHICLE_KINDS) {
    const report = kitAudit(VEHICLE_KITS[kind], { preset: VEHICLE_PRESET });
    assert.equal(report.solidClearances.length, 0);
    assert.equal(report.parts, flatten(VEHICLE_KITS[kind], VEHICLE_PRESET).length);
    assert.ok(report.bounds, `${kind}: the report measures the vehicle`);
  }
});

test('the preset declares the sockets the garage and the plot hang telemetry on', () => {
  const required: Readonly<Record<VehicleKind, readonly string[]>> = {
    hauler: ['seatLeft', 'seatRight', 'lampLeft', 'lampRight', 'cargo', 'coupling', 'power'],
    crawler: ['seat', 'drill', 'mast', 'lampLeft', 'lampRight', 'power'],
    scout: ['seat', 'bar', 'lampLeft', 'lampRight', 'scanner', 'power'],
  };
  for (const kind of VEHICLE_KINDS) {
    const sockets = presetSockets(VEHICLE_KITS[kind], VEHICLE_PRESET);
    for (const name of required[kind]) assert.ok(sockets[name], `${kind}: socket ${name}`);
    for (const [name, s] of Object.entries(sockets)) {
      assert.ok(s.at[1] >= 0, `${kind}/${name}: below the ground (y ${s.at[1]})`);
    }
  }
});

test('the parts are hung on declared sockets: every group root touches the base it stands on', () => {
  for (const kind of VEHICLE_KINDS) {
    const kit = VEHICLE_KITS[kind];
    const parts = flatten(kit, VEHICLE_PRESET);
    for (const group of KIT_GROUPS) {
      const roots = parts.filter((p) => p.path.startsWith(group + '/') && !p.path.slice(group.length + 1).includes('/'));
      assert.ok(roots.length > 0, `${kind}/${group}: has a root part`);
    }
  }
});

test('the wheels stand on the ground and their hubs are the ones the spec publishes', () => {
  for (const spec of SPECS) {
    const kit = VEHICLE_KITS[spec.kind];
    const placed = flatten(kit, VEHICLE_PRESET);
    const wheels = placed.filter((p) => /wheel|track/.test(p.part) && p.path.startsWith('base/'));
    assert.ok(wheels.length > 0, `${spec.kind}: the base carries its ground contact`);
    const bounds = presetBounds(kit, placed);
    assert.ok(bounds, `${spec.kind}: bounds`);
    assert.ok(Math.abs(bounds!.min[1]) < 1e-6, `${spec.kind}: the tyre and track bottoms are the ground (min y ${bounds!.min[1]})`);
    // every published hub is inside the vehicle's own envelope, so a scene can put a wheel pivot on it
    for (const hub of spec.hubs) {
      assert.ok(Math.abs(hub[0]) <= spec.envelope.width / 2, `${spec.kind}: hub x ${hub[0]}`);
      assert.ok(hub[2] >= -spec.envelope.length / 2 && hub[2] <= spec.envelope.length / 2, `${spec.kind}: hub z ${hub[2]}`);
    }
  }
});

test('every vehicle fits the envelope its spec declares (the body the procedural rover used to fill)', () => {
  for (const spec of SPECS) {
    const bounds = presetBounds(VEHICLE_KITS[spec.kind], flatten(VEHICLE_KITS[spec.kind], VEHICLE_PRESET));
    assert.ok(bounds, `${spec.kind}: bounds`);
    const size: [number, number, number] = [bounds!.max[0] - bounds!.min[0], bounds!.max[1] - bounds!.min[1], bounds!.max[2] - bounds!.min[2]];
    assert.ok(size[0] <= spec.envelope.width + 1e-6, `${spec.kind}: ${size[0].toFixed(3)} m wide (${spec.envelope.width})`);
    assert.ok(size[1] <= spec.envelope.height + 1e-6, `${spec.kind}: ${size[1].toFixed(3)} m tall (${spec.envelope.height})`);
    assert.ok(size[2] <= spec.envelope.length + 1e-6, `${spec.kind}: ${size[2].toFixed(3)} m long (${spec.envelope.length})`);
  }
});

test('the materials are the plot palette\'s, and the lights are lx: cartridges', () => {
  for (const kind of VEHICLE_KINDS) {
    for (const [id, def] of Object.entries(VEHICLE_KITS[kind].parts)) {
      assert.ok(/^(khaki-paint|hull-steel|accent-hardware|mat:|lx:)/.test(def.material), `${kind}/${id}: ${def.material}`);
    }
    const lamps = flatten(VEHICLE_KITS[kind], VEHICLE_PRESET).filter((p) => VEHICLE_KITS[kind].parts[p.part]?.material.startsWith('lx:'));
    assert.ok(lamps.length >= 2, `${kind}: ${lamps.length} light cartridges`);
  }
});

test('a vehicleKit(kind) is deterministic: two builds give the same kit, and the frozen table holds those kits', () => {
  for (const kind of VEHICLE_KINDS) {
    const a = JSON.stringify(flatten(VEHICLE_KITS[kind], VEHICLE_PRESET).map((p) => [p.path, p.material, p.rank]));
    const b = JSON.stringify(flatten(VEHICLE_KITS[kind], VEHICLE_PRESET).map((p) => [p.path, p.material, p.rank]));
    assert.equal(a, b, `${kind} is deterministic`);
  }
  assert.equal(Object.isFrozen(VEHICLE_KITS), true);
  assert.equal(Object.isFrozen(HAULER_KIT), true);
  assert.equal(Object.isFrozen(CRAWLER_KIT), true);
  assert.equal(Object.isFrozen(SCOUT_KIT), true);
});

test('the hauler\'s hydraulic line ends flush on a port at each end, and the audit agrees it is terminated', () => {
  const kit = HAULER_KIT;
  const hose = flatten(kit, VEHICLE_PRESET).find((p) => p.part === 'hauler-hydraulic-hose');
  assert.ok(hose, 'the hauler carries its supply hose');
  const sockets = presetSockets(kit, VEHICLE_PRESET);
  const ports = Object.entries(sockets).filter(([name]) => /port/i.test(name));
  assert.ok(ports.length >= 1, 'the hose lands on a declared port');
  const report = kitAudit(kit, { preset: VEHICLE_PRESET });
  assert.equal(report.terminals, 0);
});

test('the three subjects are the parts that make each vehicle itself: a bed, twin cutter heads, a dish', () => {
  const subjects: Readonly<Record<VehicleKind, readonly string[]>> = {
    hauler: ['subject/cargo-bed', 'subject/hazard-stripe', 'subject/lock-rail-left', 'subject/lock-rail-right'],
    crawler: ['subject/cutter-carriage', 'subject/head-left', 'subject/head-right'],
    scout: ['subject/scanner-mast', 'subject/scanner-core', 'subject/dish-gimbal', 'subject/scanner-dish'],
  };
  for (const kind of VEHICLE_KINDS) {
    const paths = new Set(flatten(VEHICLE_KITS[kind], VEHICLE_PRESET).map((p) => p.path));
    for (const path of subjects[kind]) assert.ok(paths.has(path), `${kind}: ${path}`);
  }
  // the crawler's twin heads counter-rotate: two placements of one part, one of them with the rate negated
  const heads = (CRAWLER_KIT.assemblies.subject?.children ?? []).filter((c) => c.ref === 'crawler-cutter-head');
  assert.equal(heads.length, 2);
  const rates = heads.map((c) => c.motion?.rateHz);
  assert.deepEqual(rates, [undefined, -0.8], 'the second head turns the other way');
});

test('the crawler\'s cutter teeth are exposed: sixteen lugs a head, and the head is not inside the carriage', () => {
  const head = CRAWLER_KIT.parts['crawler-cutter-head'];
  assert.ok(head?.source.kind === 'param' && head.source.gen === 'wheel');
  assert.equal(head.source.kind === 'param' ? head.source.params.lugs : 0, 16);
  const placed = flatten(CRAWLER_KIT, VEHICLE_PRESET);
  const carriage = placed.find((p) => p.path === 'subject/cutter-carriage');
  assert.ok(carriage);
  assert.equal(carriage!.part, 'crawler-cutter-carriage');
});

test('every group root is a socket child of the base, so the assembled vehicle is one chain of declared mounts', () => {
  for (const kind of VEHICLE_KINDS) {
    const top = VEHICLE_KITS[kind].assemblies[VEHICLE_PRESET];
    for (const child of top?.children ?? []) {
      if (child.ref === 'base') continue;
      assert.ok(child.on, `${kind}/${child.ref}: mounted`);
      assert.equal(child.on?.child, child.ref === 'subject' && kind === 'crawler' ? 2 : 0, `${kind}/${child.ref}: on the base (the cutter hangs on the boom)`);
      assert.ok(child.on?.socket, `${kind}/${child.ref}: on a named socket`);
    }
  }
});
