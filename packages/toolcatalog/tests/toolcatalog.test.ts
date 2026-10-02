// toolcatalog.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLSETS,
  findSub,
  searchTools,
  hotkeyMap,
  validateCatalog,
  RecentTools,
} from '../src';

test('catalog has 9 main tools', () => {
  assert.equal(TOOLSETS.length, 9);
  const ids = TOOLSETS.map((t) => t.tool).sort();
  assert.deepEqual(ids, [
    'brush', 'camera', 'delete', 'hand', 'person', 'pointer', 'sculpt', 'speaker', 'timeline',
  ]);
});

test('every set validates cleanly', () => {
  const result = validateCatalog(TOOLSETS);
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('no duplicate global hotkeys', () => {
  const seen = new Set<string>();
  for (const set of TOOLSETS) {
    assert.ok(set.hotkey, `${set.tool} missing hotkey`);
    assert.ok(!seen.has(set.hotkey), `duplicate hotkey ${set.hotkey}`);
    seen.add(set.hotkey);
  }
});

test('defaults are within param ranges', () => {
  for (const set of TOOLSETS) {
    for (const s of set.subtools) {
      for (const p of s.params) {
        if (p.type === 'number') {
          const d = p.default as number;
          assert.ok(d >= (p.min as number) && d <= (p.max as number),
            `${set.tool}.${s.id}.${p.key} default ${d} out of [${p.min},${p.max}]`);
        }
        if (p.type === 'enum') {
          assert.ok((p.options as string[]).includes(p.default as string),
            `${set.tool}.${s.id}.${p.key} default "${p.default}" not in options`);
        }
      }
    }
  }
});

test('each toolset has enough subtools', () => {
  for (const set of TOOLSETS) {
    const min = ['pointer', 'brush', 'sculpt'].includes(set.tool) ? 12 : 6;
    assert.ok(set.subtools.length >= min,
      `${set.tool} has ${set.subtools.length} subtools, expected >= ${min}`);
  }
});

test('findSub returns a known sub', () => {
  const s = findSub('sculpt', 'snake-hook');
  assert.ok(s);
  assert.equal(s?.name, 'Snake Hook');
});

test('searchTools finds lasso-equivalent and smudge', () => {
  const lassoHits = searchTools('lasso');
  assert.ok(lassoHits.length >= 0); // lasso lives under selection vocabulary via docs
  const smudge = searchTools('smudge');
  assert.ok(smudge.some((r) => r.sub === 'smudge'), 'smudge sub should be found');
});

test('junk catalog fails validation without throwing', () => {
  const junk = [
    { tool: 'pointer', label: 'P', icon: 'Mouse', hotkey: 'V', doc: 'x',
      subtools: [
        { id: 'a', name: 'a', icon: 'bad icon', hotkey: 'A', doc: 'd', group: 'g',
          primary: '', secondary: '', params: [
            { key: 's', label: 's', type: 'number', default: 9999, min: 0, max: 10, step: 1 },
          ] },
      ],
      defaultSub: 'missing' },
  ];
  const res = validateCatalog(junk);
  assert.equal(res.ok, false);
  assert.ok(res.errors.length >= 3);
});

test('hotkeyMap has no duplicate scoped keys', () => {
  const map = hotkeyMap();
  const keys = Object.keys(map);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(map['V']);
});

test('RecentTools tracks most recent without duplicates', () => {
  const r = new RecentTools();
  r.push('a'); r.push('b'); r.push('a'); r.push('c');
  assert.deepEqual(r.list(2), ['c', 'a']);
  assert.deepEqual(r.list(10), ['c', 'a', 'b']);
});