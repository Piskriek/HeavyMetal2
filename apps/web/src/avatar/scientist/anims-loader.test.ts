import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { decodeAnimationClips, CLIP_NAMES } from './anims-loader';

test('anims-loader: decodes all 14 clips from anims.bin cleanly', () => {
  const binPath = path.resolve('apps/web/src/avatar/scientist/anims.bin');
  assert.ok(fs.existsSync(binPath), 'anims.bin must exist');
  const buffer = fs.readFileSync(binPath);

  const clips = decodeAnimationClips(buffer);
  assert.equal(clips.size, 14);

  for (const name of CLIP_NAMES) {
    assert.ok(clips.has(name), `Missing clip: ${name}`);
    const clip = clips.get(name)!;
    assert.ok(clip.duration > 0, `Clip ${name} duration must be positive`);
    assert.ok(clip.tracks.length > 0, `Clip ${name} must contain tracks`);

    // Hips position track present
    const hipsPos = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
    assert.ok(hipsPos, `Clip ${name} must have mixamorigHips.position`);

    // Verify all quaternion tracks are normalized unit quaternions
    for (const track of clip.tracks) {
      if (track.name.endsWith('.quaternion')) {
        for (let i = 0; i < track.values.length; i += 4) {
          const qx = track.values[i]!;
          const qy = track.values[i + 1]!;
          const qz = track.values[i + 2]!;
          const qw = track.values[i + 3]!;
          const len = Math.hypot(qx, qy, qz, qw);
          assert.ok(Math.abs(len - 1.0) < 1e-4, `Quaternion not normalized in ${clip.name} track ${track.name}: ${len}`);
        }
      }
    }
  }
});

test('anims-loader: AnimationMixer successfully binds and steps decoded clips', () => {
  const binPath = path.resolve('apps/web/src/avatar/scientist/anims.bin');
  const buffer = fs.readFileSync(binPath);
  const clips = decodeAnimationClips(buffer);

  // Create a minimal root with mixamorig bones
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'mixamorigHips';
  root.add(hips);
  const spine = new THREE.Bone();
  spine.name = 'mixamorigSpine';
  hips.add(spine);

  const mixer = new THREE.AnimationMixer(root);
  const walk = clips.get('walking')!;
  const action = mixer.clipAction(walk);
  action.play();

  assert.doesNotThrow(() => {
    mixer.update(0.016);
    mixer.update(0.1);
  });
});
