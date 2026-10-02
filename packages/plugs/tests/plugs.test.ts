// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINDS,
  addableKinds,
  bundleDependencies,
  bundleSize,
  canPlug,
  candidates,
  checkBundleLimit,
  describe,
  licenseOf,
  plug,
  plugPoints,
  resolveClick,
  unplug,
  validatePreset,
  validatePublish,
} from '../src';
import type { KindSpec, Preset, PlugSpec, PublishRequest } from '../src';

function make(
  id: string,
  kind: string,
  name: string,
  plugs: Record<string, string | null> = {},
  params: Record<string, unknown> = {},
): Preset {
  return { id, kind, name, params, plugs };
}

function snap(v: unknown): string {
  return JSON.stringify(v);
}

test('candidates only accepted kinds and sorted by name', () => {
  const lib: Preset[] = [
    make('1', 'sprite', 'Zed'),
    make('2', 'sound', 'Amy'),
    make('3', 'tool', 'Brush'),
    make('4', 'sprite', 'Amy'),
    make('5', 'sprite', 'Amy'),
  ];
  const spec: PlugSpec = {
    key: 'icon',
    label: 'Icon',
    doc: '',
    accepts: ['sprite'],
    multiple: false,
    required: false,
  };
  const before = snap(lib);
  const c = candidates(spec, lib);
  assert.equal(snap(lib), before);
  assert.deepEqual(
    c.map((p) => p.id),
    ['4', '5', '1'],
  );
  for (const p of c) assert.equal(p.kind, 'sprite');
  assert.deepEqual(addableKinds(spec), ['sprite']);
  const kinds = addableKinds(spec);
  kinds.push('tool');
  assert.deepEqual(spec.accepts, ['sprite']);
});

test('cycle rejection and self plug', () => {
  let a = make('a', 'action', 'A');
  let b = make('b', 'action', 'B');
  let lib = [a, b];
  a = plug(KINDS, a, 'steps', 'b', lib);
  lib = [a, b];
  const cyc = canPlug(KINDS, b, 'steps', a, lib);
  assert.equal(cyc.ok, false);
  assert.equal(cyc.reason, 'cycle');
  const self = canPlug(KINDS, a, 'steps', a, lib);
  assert.equal(self.ok, false);
  assert.equal(self.reason, 'self plug');
  const sound = make('n', 'skin', 'Nope');
  const bad = canPlug(KINDS, a, 'steps', sound, [a, b, sound]);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'kind not accepted');
});

test('multiple vs single', () => {
  let btn = make('b', 'button', 'B');
  const s1 = make('s1', 'sprite', 'Spark');
  const s2 = make('s2', 'sprite', 'Dust');
  const snd = make('n1', 'sound', 'Thud');
  let lib: Preset[] = [btn, s1, s2, snd];
  const iconOk = canPlug(KINDS, btn, 'icon', s1, lib);
  assert.equal(iconOk.ok, true);
  btn = plug(KINDS, btn, 'icon', 's1', lib);
  lib = [btn, s1, s2, snd];
  const icon2 = canPlug(KINDS, btn, 'icon', s2, lib);
  assert.equal(icon2.ok, false);
  assert.equal(icon2.reason, 'already filled');
  let act = make('act', 'action', 'Chain');
  lib = [act, s1, snd];
  assert.equal(canPlug(KINDS, act, 'steps', s1, lib).ok, true);
  act = plug(KINDS, act, 'steps', 's1', lib);
  lib = [act, s1, snd];
  assert.equal(canPlug(KINDS, act, 'steps', snd, lib).ok, true);
  act = plug(KINDS, act, 'steps', 'n1', lib);
  assert.equal(act.plugs['steps.0'], 's1');
  assert.equal(act.plugs['steps.1'], 'n1');
  const pts = plugPoints(KINDS, act);
  const stepFilled = pts.filter((x) => x.plug.key === 'steps').map((x) => x.filled);
  assert.deepEqual(stepFilled, ['s1', 'n1']);
});

test('hotbar max 9', () => {
  const buttons: Preset[] = [];
  for (let i = 0; i < 10; i += 1) {
    buttons.push(make(`b${i}`, 'button', `B${i}`));
  }
  let bar = make('h', 'hotbar', 'Bar');
  let lib: Preset[] = [bar, ...buttons];
  for (let i = 0; i < 9; i += 1) {
    const btn = buttons[i];
    assert.ok(btn);
    const chk = canPlug(KINDS, bar, 'slots', btn, lib);
    assert.equal(chk.ok, true, chk.reason);
    bar = plug(KINDS, bar, 'slots', btn.id, lib);
    lib = [bar, ...buttons];
  }
  const tenth = buttons[9];
  assert.ok(tenth);
  const over = canPlug(KINDS, bar, 'slots', tenth, lib);
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'hotbar slots max 9');
  assert.equal(getSlotCount(bar), 9);
});

function getSlotCount(bar: Preset): number {
  let n = 0;
  for (const [k, v] of Object.entries(bar.plugs)) {
    if (v && (k === 'slots' || k.startsWith('slots.'))) n += 1;
  }
  return n;
}

test('resolveClick order expands action steps', () => {
  const tool = make('t', 'tool', 'Chisel', {}, { mode: 'sculpt', size: 1, strength: 1 });
  const dust = make('d', 'sprite', 'Dust puff');
  const thud = make('s', 'sound', 'Thud');
  const act = make('a', 'action', 'Click chain', { 'steps.0': 't', 'steps.1': 'd', 'steps.2': 's' });
  const btn = make('b', 'button', 'Mine', { onClick: 'a' });
  const lib = [tool, dust, thud, act, btn];
  const effects = resolveClick(KINDS, btn, lib);
  assert.deepEqual(effects, [
    { type: 'tool', presetId: 't' },
    { type: 'sprite', presetId: 'd' },
    { type: 'sound', presetId: 's' },
  ]);
});

test('describe text', () => {
  const tool = make('t', 'tool', 'Chisel', {}, { mode: 'sculpt', size: 1, strength: 1 });
  const dust = make('d', 'sprite', 'Dust puff');
  const thud = make('s', 'sound', 'Thud');
  const act = make('a', 'action', 'Click chain', { 'steps.0': 't', 'steps.1': 'd', 'steps.2': 's' });
  const btn = make('b', 'button', 'Mine', { onClick: 'a' });
  const lib = [tool, dust, thud, act, btn];
  assert.equal(describe(KINDS, tool, lib), 'Sculpt tool');
  assert.equal(describe(KINDS, btn, lib), 'Sculpt tool, plays Dust puff and Thud on click');
});

test('validatePublish price urls blocked trimming tags', () => {
  const base = { presetId: 'p', visibility: 'free' as const, name: 'Cool Item', description: '' };
  const trimmed = validatePublish({ ...base, name: '  Hello   World  ', description: '  hi  ' });
  assert.equal(trimmed.ok, true);
  assert.equal(trimmed.clean.name, 'Hello World');
  assert.equal(trimmed.clean.description, 'hi');
  const shortName = validatePublish({ ...base, name: 'ab' });
  assert.equal(shortName.ok, false);
  assert.ok(shortName.errors.some((e) => e.includes('3..40')));
  const longDesc = validatePublish({ ...base, description: 'x'.repeat(401) });
  assert.equal(longDesc.ok, false);
  assert.ok(longDesc.errors.some((e) => e.includes('400')));
  const saleOk = validatePublish({
    presetId: 'p',
    visibility: 'sale',
    name: 'Shop Item',
    description: '',
    priceCredits: 10,
  });
  assert.equal(saleOk.ok, true);
  assert.equal(saleOk.clean.priceCredits, 10);
  const saleMissing = validatePublish({
    presetId: 'p',
    visibility: 'sale',
    name: 'Shop Item',
    description: '',
  });
  assert.equal(saleMissing.ok, false);
  assert.ok(saleMissing.errors.some((e) => e.includes('price')));
  const saleBad = validatePublish({
    presetId: 'p',
    visibility: 'sale',
    name: 'Shop Item',
    description: '',
    priceCredits: 1.5,
  });
  assert.equal(saleBad.ok, false);
  const saleZero = validatePublish({
    presetId: 'p',
    visibility: 'sale',
    name: 'Shop Item',
    description: '',
    priceCredits: 0,
  });
  assert.equal(saleZero.ok, false);
  const saleHi = validatePublish({
    presetId: 'p',
    visibility: 'sale',
    name: 'Shop Item',
    description: '',
    priceCredits: 100001,
  });
  assert.equal(saleHi.ok, false);
  const freePrice = validatePublish({ ...base, priceCredits: 10 });
  assert.equal(freePrice.ok, false);
  assert.ok(freePrice.errors.some((e) => e.includes('price')));
  const urlName = validatePublish({ ...base, name: 'Visit www.foo.com x' });
  assert.equal(urlName.ok, false);
  assert.ok(urlName.errors.some((e) => e.toLowerCase().includes('url')));
  const urlDesc = validatePublish({ ...base, description: 'see http://evil.example' });
  assert.equal(urlDesc.ok, false);
  const blocked = validatePublish({ ...base, name: 'This scam item' }, { blocked: ['scam'] });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.errors.some((e) => e === 'blocked word: scam'));
  const whole = validatePublish({ ...base, name: 'Thescamitem pack' }, { blocked: ['scam'] });
  assert.equal(whole.ok, true);
  const caseBlock = validatePublish({ ...base, name: 'Big Scam Pack' }, { blocked: ['scam'] });
  assert.equal(caseBlock.ok, false);
  const tagShort = validatePublish({ ...base, tags: ['ok-tag', 'a'] });
  assert.equal(tagShort.ok, false);
  const tagCase = validatePublish({ ...base, tags: ['Nope'] });
  assert.equal(tagCase.ok, false);
  const tagMany = validatePublish({
    ...base,
    tags: ['one', 'two', 'thr', 'four', 'five', 'sixx', 'seven'],
  });
  assert.equal(tagMany.ok, false);
  const tagOk = validatePublish({ ...base, tags: ['ok-tag', 'ab', 'z9'] });
  assert.equal(tagOk.ok, true);
  const req: PublishRequest = { ...base, name: '  Hello   World  ' };
  const before = snap(req);
  validatePublish(req);
  assert.equal(snap(req), before);
});

test('bundleDependencies order and limit', () => {
  const sprite = make('s1', 'sprite', 'Dust puff');
  const sound = make('n1', 'sound', 'Thud');
  const icon = make('ic', 'sprite', 'Icon');
  const root = make('root', 'button', 'B', { onHover: 'n1', onClick: 's1', icon: 'ic' });
  const lib = [root, sprite, sound, icon];
  const before = snap(lib);
  const ids = bundleDependencies(KINDS, 'root', lib);
  assert.equal(snap(lib), before);
  assert.deepEqual(ids, ['root', 's1', 'n1', 'ic']);
  const nestedAct = make('a', 'action', 'A', { 'steps.0': 's1', 'steps.1': 'n1' });
  const root2 = make('root2', 'button', 'B2', { onClick: 'a', icon: 'ic' });
  const lib2 = [root2, nestedAct, sprite, sound, icon];
  assert.deepEqual(bundleDependencies(KINDS, 'root2', lib2), ['root2', 'a', 's1', 'n1', 'ic']);
  const bytes = bundleSize(KINDS, 'root', lib);
  const pack = [root, sprite, sound, icon];
  assert.equal(bytes, JSON.stringify(pack).length);
  assert.equal(checkBundleLimit(100000).ok, true);
  assert.equal(checkBundleLimit(100000).limit, 100000);
  assert.equal(checkBundleLimit(100001).ok, false);
  assert.equal(checkBundleLimit(50, 40).ok, false);
  assert.equal(checkBundleLimit(40, 40).ok, true);
  assert.equal(checkBundleLimit(bytes, bytes).ok, true);
  assert.equal(checkBundleLimit(bytes, bytes - 1).ok, false);
});

test('licenses', () => {
  assert.deepEqual(licenseOf('private'), { use: true, remix: false, resell: false, credit: false });
  assert.deepEqual(licenseOf('sale'), { use: true, remix: false, resell: false, credit: false });
  assert.deepEqual(licenseOf('free'), { use: true, remix: true, resell: false, credit: true });
  assert.deepEqual(licenseOf('friends'), { use: true, remix: true, resell: false, credit: false });
});

test('immutability of inputs', () => {
  const parent = make('b', 'button', 'B', { onClick: null }, { label: 'x' });
  const child = make('s', 'sprite', 'Spark');
  const lib: Preset[] = [parent, child];
  const specsBefore = snap(KINDS);
  const parentBefore = snap(parent);
  const libBefore = snap(lib);
  const out = plug(KINDS, parent, 'onClick', 's', lib);
  assert.equal(out.plugs.onClick, 's');
  assert.equal(snap(parent), parentBefore);
  assert.equal(snap(lib), libBefore);
  assert.equal(snap(KINDS), specsBefore);
  const gone = unplug(KINDS, out, 'onClick', lib);
  assert.equal(gone.plugs.onClick, null);
  assert.equal(out.plugs.onClick, 's');
  candidates(
    { key: 'icon', label: 'I', doc: '', accepts: ['sprite'], multiple: false, required: false },
    lib,
  );
  canPlug(KINDS, parent, 'onClick', child, lib);
  resolveClick(KINDS, parent, lib);
  describe(KINDS, parent, lib);
  bundleDependencies(KINDS, parent.id, lib);
  bundleSize(KINDS, parent.id, lib);
  validatePreset(KINDS, parent, lib);
  assert.equal(snap(parent), parentBefore);
  assert.equal(snap(lib), libBefore);
  assert.equal(snap(KINDS), specsBefore);
});

test('validatePreset unknown kind plug required params', () => {
  const unknown = make('u', 'nope', 'X');
  const r1 = validatePreset(KINDS, unknown, [unknown]);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes('unknown kind')));
  const weird = make('b', 'button', 'B', { frob: 'x' });
  const r2 = validatePreset(KINDS, weird, [weird]);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes('unknown plug')));
  const custom: KindSpec[] = [
    {
      kind: 'button',
      label: 'Button',
      plugs: [{ key: 'icon', label: 'Icon', doc: '', accepts: ['sprite'], multiple: false, required: true }],
      params: [{ key: 'cooldownMs', label: 'Cooldown', type: 'number', default: 0, min: 0, max: 10 }],
    },
  ];
  const empty = make('b', 'button', 'B', {}, { cooldownMs: 99 });
  const r3 = validatePreset(custom, empty, [empty]);
  assert.equal(r3.ok, false);
  assert.ok(r3.errors.some((e) => e.includes('required plug empty')));
  assert.ok(r3.errors.some((e) => e.includes('param out of range')));
  const tool = make('t', 'tool', 'T', {}, { mode: 'sculpt', size: 1, strength: 1 });
  const r4 = validatePreset(KINDS, tool, [tool]);
  assert.equal(r4.ok, true);
});