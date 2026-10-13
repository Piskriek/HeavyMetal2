import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decodeAnimationClips } from '../scientist/anims-loader';

const RIFLE_CLIPS = [
  'rifle-idle', 'rifle-aiming-idle', 'firing-rifle', 'rifle-walk', 'rifle-run', 'backwards-rifle-walk',
  'strafe-left', 'strafe-right', 'rifle-pull-out', 'rifle-put-away', 'reloading',
];

test('rifle-anims.bin: the 11 rifle clips decode, sit on the mixamorig rig, and their root stays in place', () => {
  const binPath = path.resolve('apps/web/src/avatar/astro/rifle-anims.bin');
  assert.ok(fs.existsSync(binPath), 'rifle-anims.bin must exist (node scripts/pack-anims.mjs --rifle)');
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
