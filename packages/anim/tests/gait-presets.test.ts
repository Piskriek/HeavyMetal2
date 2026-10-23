import test from 'node:test';
import assert from 'node:assert/strict';
import { GAIT_CLIP_SCHEMA, gaitPoseAt, validateGaitClipSpec } from '../src/index';
const gait = { stepFrequency: 1.9, strideLength: 0.75, hipBob: 0.035, footIkWeight: 0.8, armSwingDeg: 28, leanDeg: 4 };
test('gait clip validates, has schema and evaluates deterministically', () => {
  assert.deepEqual(validateGaitClipSpec(gait), []);
  assert.ok(GAIT_CLIP_SCHEMA.params.some((p) => p.key === 'footIkWeight'));
  assert.deepEqual(gaitPoseAt(gait, 0.37), gaitPoseAt(gait, 0.37));
  assert.notDeepEqual(gaitPoseAt(gait, 0.1), gaitPoseAt(gait, 0.35));
  assert.ok(validateGaitClipSpec({ ...gait, footIkWeight: 2 }).length > 0);
});
