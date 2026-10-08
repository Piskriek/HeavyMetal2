import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { decodeAnimationClips } from './anims-loader';
import { createScientistAnimator } from './animator';

test('animator: idle starts with breathing-idle weight 1', () => {
  const binPath = path.resolve('apps/web/src/avatar/scientist/anims.bin');
  const buffer = fs.readFileSync(binPath);
  const clips = decodeAnimationClips(buffer);

  const root = new THREE.Group();
  const animator = createScientistAnimator(root, clips);

  animator.update(0.016);
  assert.ok(animator.getClipWeight('breathing-idle') > 0.9);
  assert.equal(animator.getClipWeight('walking'), 0);
  animator.dispose();
});

test('animator: walking forward sets walking weight above 0.5', () => {
  const binPath = path.resolve('apps/web/src/avatar/scientist/anims.bin');
  const buffer = fs.readFileSync(binPath);
  const clips = decodeAnimationClips(buffer);

  const root = new THREE.Group();
  const animator = createScientistAnimator(root, clips);

  // Advance several frames walking forward
  for (let i = 0; i < 20; i++) {
    animator.update(0.05, { forward: 1, strafe: 0, run: false });
  }

  assert.ok(
    animator.getClipWeight('walking') > 0.5,
    `Walking weight should be > 0.5, got ${animator.getClipWeight('walking')}`
  );
  assert.ok(animator.getClipWeight('breathing-idle') < 0.2);
  animator.dispose();
});

test('animator: running forward sets running weight above 0.5', () => {
  const binPath = path.resolve('apps/web/src/avatar/scientist/anims.bin');
  const buffer = fs.readFileSync(binPath);
  const clips = decodeAnimationClips(buffer);

  const root = new THREE.Group();
  const animator = createScientistAnimator(root, clips);

  for (let i = 0; i < 20; i++) {
    animator.update(0.05, { forward: 1, strafe: 0, run: true });
  }

  assert.ok(
    animator.getClipWeight('running') > 0.5,
    `Running weight should be > 0.5, got ${animator.getClipWeight('running')}`
  );
  assert.ok(animator.getClipWeight('walking') < 0.1);
  animator.dispose();
});

test('animator: one-shot lever triggers pulling-lever', () => {
  const binPath = path.resolve('apps/web/src/avatar/scientist/anims.bin');
  const buffer = fs.readFileSync(binPath);
  const clips = decodeAnimationClips(buffer);

  const root = new THREE.Group();
  const animator = createScientistAnimator(root, clips);

  animator.playOneShot('lever');
  assert.equal(animator.currentOneShot, 'lever');

  animator.update(0.1);
  assert.ok(animator.getClipWeight('pulling-lever') > 0.1);
  animator.dispose();
});
