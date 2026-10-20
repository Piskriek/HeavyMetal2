import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildPart, triangleCount } from '@hm/partgen';
import { MESH_OPERATORS } from '@hm/meshops';
import type { PartSpec } from '@hm/cartlab';
import { applyOps, BENCH_OPERATORS, overrideFromPart, partBill, partName, PART_COSTS } from './part-cartridge';
import { buildKitPreset } from './kit-build';
import { CAPACITOR_BANK_KIT } from './kit-capacitor-bank';

const FAT_GREEN: PartSpec = { name: 'Fat green bolt', gen: 'bolt', params: { headWidth: 0.12, head: 0 }, slotMaterials: { metal: 'green' }, ops: [{ op: 'chamfer-hard-edges', params: {} }] };

test('every generator has a cost, billed in raw vertices and raw pixels', () => {
  for (const g of ['bolt', 'bracket', 'panel', 'grille', 'duct', 'can', 'beam']) assert.ok(PART_COSTS[g], g);
  assert.deepEqual(partBill({ gen: 'bolt' }), [{ item: 'vtx-rough', n: 5 }, { item: 'pxd-mono', n: 5 }]);
  assert.deepEqual(partBill({ gen: 'can' }), [{ item: 'vtx-rough', n: 20 }, { item: 'pxd-mono', n: 15 }]);
});

test('the bench offers six one-click operators, all real', () => {
  assert.equal(BENCH_OPERATORS.length, 6);
  for (const b of BENCH_OPERATORS) assert.ok(MESH_OPERATORS[b.op], b.op);
});

test('operators change the mesh, in order, and unknown ones are skipped', () => {
  const base = buildPart('can', {}, 2)!;
  const chamfered = applyOps(base, [{ op: 'chamfer-hard-edges', params: {} }]);
  assert.notEqual(triangleCount(chamfered), triangleCount(base));
  assert.equal(applyOps(base, [{ op: 'nope', params: {} }]), base);
  assert.equal(applyOps(base, undefined), base);
});

test('a printed fat green bolt overrides one skid bolt in the capacitor bank', () => {
  const mats = Object.fromEntries(['darkSteel', 'gunmetal', 'copper', 'hazard', 'green'].map((n) => [n, new THREE.MeshStandardMaterial({ name: n })]));
  const path = 'bolts-left[0]';
  const b = buildKitPreset(CAPACITOR_BANK_KIT, 'capacitor-bank', { materials: mats, gen: () => new THREE.Group(), maxRank: 2, overrides: { [path]: overrideFromPart(FAT_GREEN) } })!;
  const hit = b.placed.find((p) => p.path === path)!;
  assert.equal(hit.material, 'green');
  assert.deepEqual(hit.slotMaterials, { metal: 'green' });
  assert.ok(hit.source.kind === 'param' && hit.source.params.headWidth === 0.12 && hit.source.ops?.[0]?.op === 'chamfer-hard-edges');
  assert.equal(b.placed.find((p) => p.path === 'bolts-left[1]')!.material, 'gunmetal', 'the other bolts stay as they were');
  assert.ok(b.group.children.some((m) => m.name.startsWith('kit:green')), 'the green bolt draws');
});

test('a part gets a plain name from its generator and materials', () => {
  assert.equal(partName(FAT_GREEN, (id) => (id === 'green' ? 'Signal green' : id)), 'Bolt, signal green');
});
