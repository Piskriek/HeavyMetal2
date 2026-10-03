import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BONES } from '@hm/anim';
import type { VoxelModel } from '@hm/voxel';
import { MODELS } from '@hm/voxelart';
import { HERO_GOBLIN_RIG, HUMAN_RIG, splitBones } from '../src/avatar-view';

const goblin = MODELS.find((m) => m.id === 'goblin')!.build() as unknown as VoxelModel;

test('the voxel goblin splits into six non-empty bones and no voxel is lost or doubled', () => {
  const parts = splitBones(goblin, HERO_GOBLIN_RIG);
  let total = 0;
  for (const bone of BONES) {
    const n = parts[bone].reduce((a, v) => a + (v ? 1 : 0), 0);
    assert.ok(n > 20, `${bone} has ${n} voxels`);
    total += n;
  }
  assert.equal(total, goblin.cells.reduce((a, v) => a + (v ? 1 : 0), 0));
});

test('left and right limbs are mirror images in size (the shield aside) and the joints sit inside the model', () => {
  const parts = splitBones(goblin, HERO_GOBLIN_RIG);
  const count = (b: keyof typeof parts): number => parts[b].reduce((a, v) => a + (v ? 1 : 0), 0);
  assert.equal(count('legL'), count('legR'));
  assert.ok(count('armL') > count('armR'), 'the left arm carries the shield');
  for (const bone of BONES) {
    const j = HERO_GOBLIN_RIG.joints[bone];
    for (let i = 0; i < 3; i++) assert.ok(j[i]! >= 0 && j[i]! <= goblin.size[i]!, `${bone} joint`);
  }
});

const human = MODELS.find((m) => m.id === 'human')!.build() as unknown as VoxelModel;

test('the voxel human splits into six non-empty bones, limbs mirror each other, joints sit inside the model', () => {
  const parts = splitBones(human, HUMAN_RIG);
  const count = (b: keyof typeof parts): number => parts[b].reduce((a, v) => a + (v ? 1 : 0), 0);
  let total = 0;
  for (const bone of BONES) { assert.ok(count(bone) > 20, `${bone} has ${count(bone)} voxels`); total += count(bone); }
  assert.equal(total, human.cells.reduce((a, v) => a + (v ? 1 : 0), 0));
  assert.equal(count('legL'), count('legR'));
  assert.equal(count('armL'), count('armR'));
  for (const bone of BONES) {
    const j = HUMAN_RIG.joints[bone];
    for (let i = 0; i < 3; i++) assert.ok(j[i]! >= 0 && j[i]! <= human.size[i]!, `${bone} joint`);
  }
});