import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VoxelModel } from '@hm/voxel';
import { HERO_GOBLIN_RIG, dressAvatar, splitBones, type DressItem } from '../src/avatar-view';

const entry = (name: string, c: number) => ({ name, color: [c, c, c] as [number, number, number], roughness: 0.8, metalness: 0, emissive: 0, alpha: 1 });
/** A 28 x 44 x 20 block (the hero goblin's frame), every cell filled with entry 1. */
function block(): VoxelModel {
  const size: [number, number, number] = [28, 44, 20];
  return { id: 'g', name: 'g', size, pivot: [14, 0, 10], palette: [entry('skin', 0.5)], cells: new Uint8Array(size[0] * size[1] * size[2]).fill(1) };
}

test('a hat on top grows the grid upward and moves with the head; a long braid stays with the head below the neck', () => {
  const hat: DressItem = { size: [4, 6, 4], cells: new Array(96).fill(1), palette: [entry('felt', 0.2)], root: [2, 0, 2], at: [14, 44, 10], bone: 'head' };
  const braid: DressItem = { size: [1, 20, 1], cells: new Array(20).fill(1), palette: [entry('hair', 0.1)], root: [0, 19, 0], at: [14, 43, 19], bone: 'head' };
  const { model, rig } = dressAvatar(block(), HERO_GOBLIN_RIG, [hat, braid]);
  assert.deepEqual(model.size, [28, 50, 20]);
  assert.deepEqual(model.pivot, [14, 0, 10], 'nothing below or beside: no shift');
  assert.equal(model.palette.length, 3);
  const bones = splitBones(model, rig);
  const count = (b: keyof typeof bones): number => bones[b].reduce((a, v) => a + (v ? 1 : 0), 0);
  assert.equal(rig.boneOf(14, 47, 10), 'head');
  assert.equal(rig.boneOf(14, 25, 19), 'head', 'the braid hangs from the head');
  assert.equal(rig.boneOf(14, 25, 10), 'body', 'the rest keeps the rig');
  assert.ok(count('head') > 0 && count('body') > 0);
});

test('a part off to the side shifts the grid, the pivot and every joint by the same amount', () => {
  const club: DressItem = { size: [3, 3, 3], cells: new Array(27).fill(1), palette: [entry('wood', 0.3)], root: [1, 1, 1], at: [0, 5, 0], bone: 'armL' };
  const base = block();
  const { model, rig } = dressAvatar(base, HERO_GOBLIN_RIG, [club]);
  assert.deepEqual(model.size, [29, 44, 21]);
  assert.deepEqual(model.pivot, [15, 0, 11]);
  assert.deepEqual(rig.joints.head, [HERO_GOBLIN_RIG.joints.head[0] + 1, HERO_GOBLIN_RIG.joints.head[1], HERO_GOBLIN_RIG.joints.head[2] + 1]);
  assert.equal(rig.boneOf(0, 5, 0), 'armL');
  assert.equal(base.size[0], 28, 'the base model is not changed');
});

test('no parts gives back the same model and rig', () => {
  const base = block();
  const r = dressAvatar(base, HERO_GOBLIN_RIG, []);
  assert.equal(r.model, base);
  assert.equal(r.rig, HERO_GOBLIN_RIG);
});
