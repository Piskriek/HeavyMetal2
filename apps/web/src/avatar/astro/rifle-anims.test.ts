import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { decodeAnimationClips } from '../scientist/anims-loader';
import { createScientistAnimator } from '../scientist/animator';
import { ASTRO_HIPS_Y } from './astro-model';

const RIFLE_CLIPS = [
  'rifle-idle', 'rifle-aiming-idle', 'firing-rifle', 'rifle-walk', 'rifle-run', 'backwards-rifle-walk',
  'strafe-left', 'strafe-right', 'rifle-pull-out', 'rifle-put-away', 'reloading',
];

test('rifle-anims.bin: the 11 rifle clips decode, sit on the mixamorig rig, and their root stays in place', () => {
  const binPath = path.resolve('apps/web/src/avatar/astro/rifle-anims.bin');
  assert.ok(fs.existsSync(binPath), 'rifle-anims.bin must exist (node --import tsx scripts/retarget-astro.ts <scientist.fbx> --rifle)');
  const bytes = fs.statSync(binPath).size;
  assert.ok(bytes <= 150 * 1024, `the rifle set is at most 150 KB (is ${bytes})`);

  const clips = decodeAnimationClips(fs.readFileSync(binPath));
  assert.equal(clips.size, RIFLE_CLIPS.length);
  for (const name of RIFLE_CLIPS) {
    const clip = clips.get(name);
    assert.ok(clip, `missing clip ${name}`);
    assert.ok(clip.duration > 0, `${name} has a duration`);
    const hips = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
    assert.ok(hips, `${name} moves the mixamorig hips`);
    for (let i = 0; i < hips.values.length; i += 3) {
      assert.equal(hips.values[i], hips.values[0], `${name}: the root does not drift in X`);
      assert.equal(hips.values[i + 2], hips.values[2], `${name}: the root does not drift in Z`);
    }
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      for (let i = 0; i < track.values.length; i += 4) {
        const len = Math.hypot(track.values[i]!, track.values[i + 1]!, track.values[i + 2]!, track.values[i + 3]!);
        assert.ok(Math.abs(len - 1) < 0.01, `${name} ${track.name} is a unit quaternion`);
      }
    }
  }
});

/** The animator with the rifle's set merged in, as the scene builds it, over a rig-less root. */
function rifleAnimator(): ReturnType<typeof createScientistAnimator> {
  const clips = decodeAnimationClips(fs.readFileSync(path.resolve('apps/web/src/avatar/scientist/anims.bin')));
  const rifle = decodeAnimationClips(fs.readFileSync(path.resolve('apps/web/src/avatar/astro/rifle-anims.bin')));
  return createScientistAnimator(new THREE.Group(), new Map([...clips, ...rifle]));
}

test('the rifle set stands Astro on its own hips height (retargeted: the hips are in metres)', () => {
  const clips = decodeAnimationClips(fs.readFileSync(path.resolve('apps/web/src/avatar/astro/rifle-anims.bin')));
  for (const name of RIFLE_CLIPS) {
    const hips = clips.get(name)!.tracks.find((t) => t.name === 'mixamorigHips.position')!;
    for (let i = 1; i < hips.values.length; i += 3) {
      assert.ok(hips.values[i]! > 0.7 && hips.values[i]! < 1.0, `${name}: hips height ${hips.values[i]} is about Astro's ${ASTRO_HIPS_Y} m (a run dips lower)`);
    }
  }
});

test('the rifle set drives the body while it is held: aiming idle when standing, firing loop when the beam is on, walk when moving', () => {
  const a = rifleAnimator();
  for (let i = 0; i < 20; i++) a.update(0.05, { forward: 0, strafe: 0, run: false, rifle: { held: true, aiming: true, firing: false } });
  assert.ok(a.getClipWeight('rifle-aiming-idle') > 0.9, `aiming idle ${a.getClipWeight('rifle-aiming-idle')}`);
  assert.ok(a.getClipWeight('breathing-idle') < 0.05, 'the unarmed idle is off');

  for (let i = 0; i < 20; i++) a.update(0.05, { forward: 0, strafe: 0, run: false, rifle: { held: true, aiming: true, firing: true } });
  assert.ok(a.getClipWeight('firing-rifle') > 0.9, `firing ${a.getClipWeight('firing-rifle')}`);
  assert.ok(a.getClipWeight('rifle-aiming-idle') < 0.05, 'the aiming idle gives way to the firing loop');

  for (let i = 0; i < 20; i++) a.update(0.05, { forward: 1, strafe: 0, run: false, rifle: { held: true, aiming: true, firing: false } });
  assert.ok(a.getClipWeight('rifle-walk') > 0.5, `rifle walk ${a.getClipWeight('rifle-walk')}`);
  assert.ok(a.getClipWeight('walking') < 0.05, 'the unarmed walk stays off');
  a.dispose();
});

test('the rifle draw, holster and reload one-shots play their own clips', () => {
  const a = rifleAnimator();
  a.playOneShot('draw');
  assert.equal(a.currentOneShot, 'draw');
  a.update(0.1, { forward: 0, strafe: 0, run: false, rifle: { held: true, aiming: false, firing: false } });
  assert.ok(a.getClipWeight('rifle-pull-out') > 0.1, `draw ${a.getClipWeight('rifle-pull-out')}`);
  a.playOneShot('reload');
  a.update(0.1, { forward: 0, strafe: 0, run: false, rifle: { held: true, aiming: false, firing: false } });
  assert.ok(a.getClipWeight('reloading') > 0.1, `reload ${a.getClipWeight('reloading')}`);
  a.playOneShot('holster');
  a.update(0.1, { forward: 0, strafe: 0, run: false, rifle: { held: false, aiming: false, firing: false } });
  assert.ok(a.getClipWeight('rifle-put-away') > 0.1, `holster ${a.getClipWeight('rifle-put-away')}`);
  assert.equal(a.getClipWeight('rifle-aiming-idle'), 0, 'a holster lets the rifle set fade out');
  a.dispose();
});
