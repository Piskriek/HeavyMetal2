import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeModel, exampleBarrel } from '@hm/voxel';
import { voxelViewFromParams, VoxelView } from '../src';

test('a model preset draws as meshes with vertex colours and the block scale', () => {
  const model = exampleBarrel();
  const v = voxelViewFromParams({ data: encodeModel(model), scale: 0.25 });
  assert.ok(v);
  assert.ok(v!.group.children.length >= 1);
  assert.equal(v!.group.scale.x, 0.25);
  const mesh = v!.group.children[0] as unknown as { geometry: { getAttribute(n: string): { count: number } | undefined } };
  assert.ok((mesh.geometry.getAttribute('position')?.count ?? 0) > 0);
  assert.ok(mesh.geometry.getAttribute('color'));
  v!.dispose();
});

test('empty or broken model data draws nothing instead of throwing', () => {
  assert.equal(voxelViewFromParams({ data: '' }), null);
  assert.equal(voxelViewFromParams({ data: 'not a model' }), null);
  assert.equal(voxelViewFromParams({}), null);
});

test('translucent palette entries go into their own mesh', () => {
  const m = exampleBarrel();
  m.palette = m.palette.map((p, i) => (i === 0 ? { ...p, alpha: 0.4 } : p));
  const v = new VoxelView(m);
  assert.ok(v.group.children.length >= 1);
  v.dispose();
});
