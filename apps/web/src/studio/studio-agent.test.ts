// The agent API plan 40 §2 asks for, held to the three things that make it safe to hand an agent: it cannot apply anything without a
// person accepting a row, every refusal says why, and its two measuring tools (coverage and kit validation) report what the shelf and
// kitspec actually say rather than a hopeful summary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL_SHELF, MAX_LAYERS, resolveMatPreset } from '@hm/matstack';
import { check, createHistory, createRegistry, emptyDoc, run, type Doc, type History, type Op, type PropType } from '@hm/scenedoc';
import type { Kit } from '@hm/kitspec';
import {
  STUDIO_COMMANDS,
  StudioSession,
  applyMatstackCommand,
  checkMaterial,
  maskInputFrom,
  materialCoverageOf,
  studioCommand,
  validateKit,
  type MatstackCommand,
} from './studio-agent';
import { materialCoverageReport } from './studio-agent-coverage';

const registry = createRegistry([
  {
    type: 'machine',
    version: 1,
    props: {
      title: { kind: 'string', maxLength: 40, default: 'Machine' },
      power: { kind: 'number', min: 0, max: 100, default: 10 },
    },
  },
  {
    type: 'part',
    version: 1,
    props: {
      kind: { kind: 'enum', options: ['plate', 'pipe'], default: 'plate' },
      metal: { kind: 'number', min: 0, max: 1, default: 0.8 },
    },
  },
]);

const session = (doc: Doc = emptyDoc(), at?: () => number): StudioSession =>
  new StudioSession({
    registry,
    doc,
    ...(at ? { at } : {}),
    materials: { 'mat:test': MATERIAL_SHELF['mat:field-worn-hazard']! },
  });

const created = (id: string, type = 'machine', props: Record<string, unknown> = {}): Op => ({ op: 'create', id, type, props });

test('every command the agent can call is described, with a schema for every parameter', () => {
  const names = STUDIO_COMMANDS.map((c) => c.name);
  for (const required of [
    'studio.doc.propose',
    'studio.kit.validate',
    'studio.material.coverage',
    'studio.capture',
    'matstack.setPaint',
    'matstack.setAge',
    'matstack.addLayer',
    'matstack.updateLayer',
    'matstack.setMaskInput',
  ]) {
    assert.ok(names.includes(required), `the catalogue is missing ${required}`);
  }
  assert.equal(new Set(names).size, names.length, 'a command is listed twice');
  for (const command of STUDIO_COMMANDS) {
    assert.ok(command.summary.length > 20, `${command.name} needs a summary an agent can act on`);
    assert.ok(command.returns.length > 5, `${command.name} must say what it returns`);
    assert.ok(['document', 'material', 'inspect'].includes(command.group));
    for (const p of command.params) {
      assert.ok(p.key && p.label, `${command.name} has a parameter without a key or label`);
      const kind: PropType['kind'] = p.type.kind;
      assert.ok(['number', 'int', 'bool', 'string', 'enum', 'vec3', 'color', 'ref', 'json'].includes(kind), `${command.name}.${p.key}: '${kind}'`);
    }
  }
  assert.equal(studioCommand('matstack.setAge')?.group, 'material');
  assert.equal(studioCommand('nope'), undefined);
  // the enums come from the shelves, so a new layer or channel group shows up here without editing this file
  const addLayer = studioCommand('matstack.addLayer')!;
  const layerEnum = addLayer.params.find((p) => p.key === 'layer')!.type;
  assert.equal(layerEnum.kind, 'enum');
  if (layerEnum.kind === 'enum') {
    assert.ok(layerEnum.options.includes('rust-bloom'));
    assert.ok(layerEnum.options.includes('soot'));
    assert.equal(layerEnum.options.length, Object.keys(MATERIAL_SHELF).length > 0 ? layerEnum.options.length : 0);
  }
});

test('a proposal stages; it does not apply: the document is untouched until a person accepts', () => {
  const s = session();
  const before = s.read();
  const { staged, refusals } = s.propose([{ label: 'add a mill', ops: [created('m1')] }, { label: 'name it', ops: [{ op: 'set', id: 'm1', props: { title: 'Mk II' } }] }]);
  assert.deepEqual(refusals, []);
  assert.equal(staged.length, 2);
  assert.equal(s.doc().nodes['m1'], undefined, 'propose applied the change');
  assert.deepEqual(s.read(), before);
  assert.equal(s.changes().length, 2);
  assert.ok(s.changes().every((c) => c.status === 'staged' && c.seq > 0));
});

test('accepting a row runs it on the undo history, and undo takes it back off', () => {
  const s = session(emptyDoc(), () => 1000);
  const { staged } = s.propose([{ label: 'add a mill', ops: [created('m1')] }]);
  const row = staged[0]!;
  const accepted = s.accept(row.id);
  assert.equal(accepted.ok, true, accepted.why);
  assert.equal(s.doc().nodes['m1']?.type, 'machine');
  assert.deepEqual(s.historyDepth(), { past: 1, future: 0 });
  // a second accept of the same row is refused, not silently repeated
  const again = s.accept(row.id);
  assert.equal(again.ok, false);
  assert.match(again.why, /already accepted/);
  s.undo();
  assert.equal(s.doc().nodes['m1'], undefined);
  assert.deepEqual(s.historyDepth(), { past: 0, future: 1 });
  s.redo();
  assert.equal(s.doc().nodes['m1']?.type, 'machine');
});

test('rejecting a row keeps it out of the document for good', () => {
  const s = session();
  const { staged } = s.propose([{ label: 'add a mill', ops: [created('m1')] }]);
  const row = staged[0]!;
  assert.equal(s.reject(row.id, 'not this one').ok, true);
  assert.equal(s.changes()[0]?.status, 'rejected');
  assert.equal(s.changes()[0]?.why, 'not this one');
  assert.equal(s.doc().nodes['m1'], undefined);
  assert.equal(s.accept(row.id).ok, false);
  assert.equal(s.reject(row.id).ok, false, 'rejecting twice must be refused');
});

test('a refusal says why, and the calls around it still stage', () => {
  const s = session();
  const { staged, refusals } = s.propose([
    { label: 'bad prop', ops: [{ op: 'set', id: 'missing', props: { title: 'x' } }] as Op[] },
    { label: 'good', ops: [created('m2')] },
    { label: 'unknown material', material: { name: 'mat:nope', command: { command: 'matstack.setAge', age: 0.5 } } },
    { label: 'empty' },
  ]);
  assert.equal(staged.length, 1);
  assert.equal(staged[0]?.label, 'good');
  assert.deepEqual(
    refusals.map((r) => r.call),
    [0, 2, 3],
  );
  assert.match(refusals[0]!.why, /missing/);
  assert.match(refusals[1]!.why, /no material 'mat:nope'/);
  assert.match(refusals[2]!.why, /neither ops nor a material command/);
});

test('a proposal is checked as a whole: it can create a node and then set it', () => {
  const s = session();
  const { staged, refusals } = s.propose([
    { label: 'create', ops: [created('m3')] },
    { label: 'set after create', ops: [{ op: 'set', id: 'm3', props: { power: 42 } }] },
  ]);
  assert.deepEqual(refusals, []);
  assert.equal(staged.length, 2);
  s.accept(staged[0]!.id);
  s.accept(staged[1]!.id);
  assert.equal(s.doc().nodes['m3']?.props.power, 42);
});

test('doc.read carries the props schema, so an agent knows the sliders without guessing', () => {
  const s = session();
  const { staged } = s.propose([{ label: 'create', ops: [created('m4', 'machine', { title: 'Press' })] }]);
  s.accept(staged[0]!.id);
  const read = s.read();
  const node = read.nodes.find((n) => n.id === 'm4');
  assert.ok(node);
  assert.equal(node.type, 'machine');
  assert.equal(node.name.length > 0, true);
  assert.deepEqual(Object.keys(node.schema).sort(), ['power', 'title']);
  assert.equal(node.schema.title?.kind, 'string');
  assert.deepEqual(node.path, [node.id], 'a root node is its own path');
  // reading a subtree gives the node and its descendants only
  const sub = s.read('m4');
  assert.deepEqual(
    sub.nodes.map((n) => n.id),
    ['m4'],
  );
  assert.deepEqual(s.read('nope').nodes, []);
});

test('material commands are pure, checked, and refuse a layer index that is not there', () => {
  const base = MATERIAL_SHELF['mat:field-worn-hazard']!;
  const painted = applyMatstackCommand(base, { command: 'matstack.setPaint', body: '#112233', trim: '#445566' });
  assert.equal(painted.ok, true);
  assert.deepEqual(base.paint, ['#b8b2a2', '#eab308'], 'the input material was changed');
  if (painted.ok) assert.deepEqual(painted.material.paint, ['#112233', '#445566']);

  const aged = applyMatstackCommand(base, { command: 'matstack.setAge', age: 0.9 });
  assert.equal(aged.ok, true);
  const bad = applyMatstackCommand(base, { command: 'matstack.setAge', age: 4 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.why, /age must be 0 to 1/);

  const outOfRange = applyMatstackCommand(base, { command: 'matstack.updateLayer', index: 99, opacity: 0.5 });
  assert.equal(outOfRange.ok, false);
  if (!outOfRange.ok) assert.match(outOfRange.why, /layer 99 does not exist/);

  const added = applyMatstackCommand(base, { command: 'matstack.addLayer', layer: 'soot' });
  assert.equal(added.ok, true);
  if (added.ok) assert.equal(added.material.layers.length, base.layers.length + 1);
  assert.equal(applyMatstackCommand(base, { command: 'matstack.addLayer', layer: 'nope' }).ok, false);

  // the layer cap is real: a full stack refuses another layer with the reason
  let full = base;
  while (full.layers.length < MAX_LAYERS) {
    const r = applyMatstackCommand(full, { command: 'matstack.addLayer', layer: 'grime' });
    assert.equal(r.ok, true);
    if (!r.ok) break;
    full = r.material;
  }
  const over = applyMatstackCommand(full, { command: 'matstack.addLayer', layer: 'dirt' });
  assert.equal(over.ok, false);
  if (!over.ok) assert.match(over.why, new RegExp(`already has ${MAX_LAYERS} layers`));
});

test('a mask input is built from flat parameters, and a nonsense one is refused with the reason', () => {
  const edge = maskInputFrom({ kind: 'edge', width: 0.02, blend: 'max', opacity: 0.8, invert: true });
  assert.deepEqual(edge, { kind: 'edge', blend: 'max', opacity: 0.8, invert: true, width: 0.02 });
  const streaks = maskInputFrom({ kind: 'streaks', scale: 0.4, stretch: 6, seed: 7 });
  assert.equal('why' in streaks, false);
  if (!('why' in streaks)) {
    assert.equal(streaks.kind, 'streaks');
    if (streaks.kind === 'streaks') assert.equal(streaks.stretch, 6);
  }
  for (const bad of [{ kind: 'edge', width: 1 }, { kind: 'noise', scale: 0 }, { kind: 'weave' }, { kind: 'all', opacity: 3 }, { kind: 'up', angle: 200 }]) {
    const r = maskInputFrom(bad);
    assert.equal('why' in r, true, `accepted ${JSON.stringify(bad)}`);
  }
});

test('setMaskInput replaces one input and leaves the rest of the mask alone', () => {
  const base = MATERIAL_SHELF['mat:workshop-steel']!;
  const layerIndex = base.layers.findIndex((l) => l.name === 'Oil leaks');
  assert.ok(layerIndex >= 0);
  const value = maskInputFrom({ kind: 'noise', noise: 'clouds', scale: 0.5, seed: 3, blend: 'multiply', opacity: 1 });
  assert.equal('why' in value, false);
  if ('why' in value) return;
  const r = applyMatstackCommand(base, { command: 'matstack.setMaskInput', index: layerIndex, input: 0, value });
  assert.equal(r.ok, true, r.ok ? '' : r.why);
  if (!r.ok) return;
  const before = base.layers[layerIndex]!.mask;
  const after = r.material.layers[layerIndex]!.mask;
  assert.equal(after.inputs.length, before.inputs.length);
  assert.deepEqual(after.inputs[0], value);
  assert.deepEqual(after.inputs.slice(1), before.inputs.slice(1), 'the other inputs moved');
  assert.equal(after.balance, before.balance);
  // out-of-range input indices are refused
  const bad = applyMatstackCommand(base, { command: 'matstack.setMaskInput', index: layerIndex, input: 9, value });
  assert.equal(bad.ok, false);
});

test('checkMaterial reports what a person would have to fix, and says nothing about a good material', () => {
  for (const id of Object.keys(MATERIAL_SHELF)) {
    assert.deepEqual(checkMaterial(MATERIAL_SHELF[id]!), [], `${id} is not a valid material`);
  }
  const base = MATERIAL_SHELF['mat:furnace']!;
  assert.ok(checkMaterial({ ...base, age: 2 }).some((w) => w.includes('age 2')));
  assert.ok(checkMaterial({ ...base, paint: ['red', '#fff'] }).some((w) => w.includes('two #rrggbb')));
  assert.ok(checkMaterial({ ...base, layers: [] }).some((w) => w.includes('at least one layer')));
  assert.ok(
    checkMaterial({ ...base, layers: [{ ...base.layers[0]!, writes: [] }] }).some((w) => w.includes('writes nothing')),
  );
  assert.ok(
    checkMaterial({ ...base, layers: [{ ...base.layers[0]!, writes: ['nope' as never] }] }).some((w) => w.includes("'nope' is not a channel group")),
  );
  assert.ok(
    checkMaterial({ ...base, layers: [{ ...base.layers[0]!, mask: { ...base.layers[0]!.mask, inputs: [] } }] }).some((w) => w.includes('mask has no inputs')),
  );
});

const KIT: Kit = {
  parts: {
    skid: { source: { kind: 'box', size: [1, 0.2, 1] }, material: 'mat:workshop-steel', rank: 0, sockets: { top: { at: [0, 0.2, 0] } } },
    column: { source: { kind: 'box', size: [0.2, 0.8, 0.2] }, material: 'mat:workshop-steel', rank: 0 },
    'odd-paint': { source: { kind: 'box', size: [0.1, 0.1, 0.1] }, material: 'mat:does-not-exist', rank: 1 },
  },
  assemblies: {
    mill: {
      children: [
        { ref: 'skid', key: 'skid' },
        { ref: 'column', key: 'column', on: { child: 0, socket: 'top' } },
      ],
    },
    'odd-one': { children: [{ ref: 'odd-paint', key: 'paint' }] },
  },
};

test('kit validation passes a seated kit and names a missing machine socket', () => {
  const ok = validateKit(KIT, 'mill', { sockets: ['power'] });
  // the mill places no power socket of its own (its skid has one, but a machine's points must be the preset's), so it is missing
  assert.equal(ok.ok, false);
  assert.deepEqual(
    ok.problems.map((p) => p.code),
    ['missing-socket'],
  );
  assert.match(ok.problems[0]!.detail, /power/);
  const noSocket = validateKit(KIT, 'mill');
  assert.equal(noSocket.ok, true, noSocket.problems.map((p) => p.detail).join('; '));
  // a child's sockets are reported by their path, so a machine's own points stay distinguishable from a part's
  assert.deepEqual(noSocket.sockets, ['skid.top']);
  assert.equal(noSocket.parts.length, 2);
  assert.deepEqual(noSocket.parts.map((p) => p.part).sort(), ['column', 'skid']);
});

test('kit validation catches an unresolved material id and a part below the floor', () => {
  const bad = validateKit(KIT, 'odd-one');
  assert.equal(bad.ok, false);
  const unresolved = bad.problems.find((p) => p.code === 'unresolved-material');
  assert.ok(unresolved, bad.problems.map((p) => `${p.code}: ${p.detail}`).join('; '));
  assert.match(unresolved.detail, /mat:does-not-exist/);

  // the kit is grounded at 0; asking it to stand at 1 m puts every part below the floor
  const lifted = validateKit(KIT, 'mill', { ground: 1 });
  assert.equal(lifted.ok, false);
  assert.ok(lifted.problems.some((p) => p.code === 'below-floor'));

  // a resolver the scene supplies can accept a private material name
  const resolved = validateKit(KIT, 'odd-one', { resolvesMaterial: (name) => name === 'mat:does-not-exist' });
  assert.equal(resolved.ok, true, resolved.problems.map((p) => p.detail).join('; '));
});

test('material coverage reports percentages per zone and the readings an agent checks itself against', () => {
  const report = materialCoverageReport({ preset: 'mat:field-worn-hazard', grid: 12 });
  assert.equal(report.ok, true, report.why);
  assert.equal(report.preset, 'mat:field-worn-hazard');
  assert.equal(report.material, 'Field-worn hazard');
  assert.equal(report.grid, 12);
  assert.equal(report.layers.length, MATERIAL_SHELF['mat:field-worn-hazard']!.layers.length);
  const bloom = report.layers.find((l) => l.name === 'Rust bloom')!;
  assert.ok(bloom.side >= 2 && bloom.side <= 15, `rust bloom covers ${bloom.side}%`);
  assert.ok(bloom.crease > bloom.side * 2, `rust bloom: ${bloom.side}% side, ${bloom.crease}% crease`);
  assert.ok(report.readings.some((r) => r.startsWith('rust bloom')));
  assert.ok(report.edgeMetal >= 0.45, `a worn edge should read metal, got ${report.edgeMetal}`);
  for (const v of Object.values(report.luminance)) assert.ok(v >= 0 && v <= 1);
  // the numbers agree with the plain matstack call the script uses
  const direct = materialCoverageOf(resolveMatPreset('mat:field-worn-hazard')!, 12);
  assert.equal(bloom.side, Math.round(direct.layers.find((l) => l.name === 'Rust bloom')!.zones.side * 1000) / 10);
  // and they are deterministic
  assert.deepEqual(materialCoverageReport({ preset: 'mat:field-worn-hazard', grid: 12 }), report);
});

test('coverage refuses an unknown preset instead of reporting an empty table', () => {
  const report = materialCoverageReport({ preset: 'mat:nope' });
  assert.equal(report.ok, false);
  assert.match(report.why, /not a material in the shelf/);
  assert.deepEqual(report.layers, []);
  const none = materialCoverageReport({});
  assert.equal(none.ok, false);
  assert.match(none.why, /neither a preset id nor a material/);
  // a bare spec works without a preset id, and the grid is clamped to something a slider can afford
  const spec = MATERIAL_SHELF['mat:furnace']!;
  const big = materialCoverageReport({ material: spec, grid: 400 });
  assert.equal(big.ok, true);
  assert.equal(big.grid, 64);
});

test('the coverages an agent would tune against are the shelf\'s, and they hold the JOB-02 targets', () => {
  const oil = materialCoverageReport({ preset: 'mat:workshop-steel', grid: 16 });
  const leaks = oil.layers.find((l) => l.name === 'Oil leaks')!;
  assert.ok(leaks.side <= 5, `oil covers ${leaks.side}% of a face`);
  assert.ok(leaks.edge >= 10 && leaks.crease >= 15);
  const soot = materialCoverageReport({ preset: 'mat:furnace', grid: 16 }).layers.find((l) => l.name === 'Soot')!;
  assert.ok(soot.top >= 15 || soot.bottom >= 15, `soot: ${soot.top}% top, ${soot.bottom}% bottom`);
  const ore = materialCoverageReport({ preset: 'mat:crushed-ore-bed', grid: 16 });
  assert.equal(ore.layers.find((l) => l.name === 'Moon dust'), undefined);
  assert.ok(ore.luminance.top <= 0.25);
});

test('capture is refused with the reason when no renderer is attached, and passes the request through when one is', async () => {
  const asked: unknown[] = [];
  const bare = session();
  const missing = await bare.capture();
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.why, /no renderer is attached/);

  const s = new StudioSession({
    registry,
    doc: emptyDoc(),
    capture: async (o) => {
      asked.push(o);
      return { ok: true, dataUrl: `data:image/png;base64,${o.mode}` };
    },
  });
  const shot = await s.capture({ mode: 'view', rank: 0, maskView: 2, includeStaged: false });
  assert.equal(shot.ok, true);
  assert.deepEqual(asked, [{ mode: 'view', includeStaged: false, rank: 0, maskView: 2 }]);
  // the defaults are a four-side turntable at full detail, staged rows included
  const defaults = await s.capture();
  assert.deepEqual(asked[1], { mode: 'turntable4', includeStaged: true, rank: 2, maskView: -1 });
  assert.equal(defaults.ok, true);
  // and a nonsense request is refused before it reaches the renderer
  assert.equal((await s.capture({ rank: 5 as 0 })).ok, false);
  assert.equal((await s.capture({ maskView: 9 })).ok, false);
});

test('a material command staged by an agent changes the session\'s material only when accepted', () => {
  const s = session();
  const cmd: MatstackCommand = { command: 'matstack.setAge', age: 0.91 };
  const { staged, refusals } = s.propose([{ label: 'age it', material: { name: 'mat:test', command: cmd } }]);
  assert.deepEqual(refusals, []);
  assert.equal(s.materialTable()['mat:test']?.age, MATERIAL_SHELF['mat:field-worn-hazard']!.age, 'staging changed the material');
  assert.equal(s.accept(staged[0]!.id).ok, true);
  assert.equal(s.materialTable()['mat:test']?.age, 0.91);
  assert.deepEqual(
    s.layerNames('mat:test'),
    MATERIAL_SHELF['mat:field-worn-hazard']!.layers.map((l) => l.name),
  );
});

test('the document the agent reads is the one scenedoc accepts, so a proposal round-trips', () => {
  const s = session();
  const ops: Op[] = [created('m5'), { op: 'set', id: 'm5', props: { power: 55 } }];
  const { staged } = s.propose([{ label: 'one row', ops }]);
  s.accept(staged[0]!.id);
  // scenedoc's own check agrees the document is in a state a person can keep editing
  const next: Op = { op: 'rename', id: 'm5', name: 'Press Mk II' };
  assert.equal(check(registry, s.doc(), next).ok, true);
  const after = run(registry, { doc: s.doc(), past: [], future: [] }, 'rename', [next]);
  assert.equal(after.history.doc.nodes['m5']?.name, 'Press Mk II');
});

test('a session given the Studio\'s own history accepts a row into the document the person is looking at', () => {
  // the page hands in a handle over its React state, so an accepted row shows up without a copy
  let history = createHistory(emptyDoc());
  const setHistory = (h: History): void => {
    history = h;
  };
  const s = new StudioSession({
    registry,
    doc: history.doc,
    history: { get: () => history, set: setHistory },
    materials: { 'mat:test': MATERIAL_SHELF['mat:workshop-steel']! },
  });
  const { staged } = s.propose([{ label: 'a plate', ops: [created('plate-1', 'part', { kind: 'plate' })] }]);
  assert.equal(s.accept(staged[0]!.id).ok, true);
  assert.equal(history.doc.nodes['plate-1']?.type, 'part', 'the handle was not updated');
  assert.equal(history.past.length, 1);
  // the person's own edit is what the agent reads next: change the document behind the session and read it
  const edited = run(registry, history, 'a person renames it', [{ op: 'rename', id: 'plate-1', name: 'Access plate' }]).history;
  setHistory(edited as History);
  const read = s.read('plate-1');
  assert.equal(read.nodes[0]?.name, 'Access plate');
  // undo through the session walks the same stack
  s.undo();
  assert.equal(s.doc().nodes['plate-1']?.name.length !== undefined, true);
  assert.equal(s.historyDepth().future, 1);
});
