import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudioSocketWritebackPatch,
  createSocketFromSurfaceHit,
} from './socket-plume-gizmo';

test('snaps socket onto surface hit and formats studio-data write-back patch', () => {
  const socket = createSocketFromSurfaceHit('texture-mill', 'pixel-exhaust', 1, [0.1, 2.4, -0.7], [0, 1, 0]);
  const patch = buildStudioSocketWritebackPatch('texture-mill', [socket]);
  assert.equal(patch.targetFile, 'docs/runworld/assets.json');
  assert.equal(patch.sockets.length, 1);
});
