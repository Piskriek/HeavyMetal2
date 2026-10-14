import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRoostStyle,
  spawnSurfaceRoostBurst,
} from '../src/footstep-and-tire-roost';
import { generateStage56CanopyInstances } from '../../treegen/src/stage56-lsystem-canopy';

test('spawns deterministic mulberry32 roost bursts and Stage 5-6 canopy trees', () => {
  assert.equal(classifyRoostStyle({ Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 }, false), 'stage0-1bit-pixels');
  const burst1 = spawnSurfaceRoostBurst(0, 0, 0, 0, 1, 8.0, { Pxd: 0.9, Vtx: 0.9, Lx: 0.9, Aq: 0.8 }, false, true, 99);
  const burst2 = spawnSurfaceRoostBurst(0, 0, 0, 0, 1, 8.0, { Pxd: 0.9, Vtx: 0.9, Lx: 0.9, Aq: 0.8 }, false, true, 99);
  assert.deepEqual(burst1, burst2);
  assert.ok(generateStage56CanopyInstances({ Pxd: 0.9, Vtx: 0.9, Lx: 0.9, Aq: 0.85 }, 0, 0, () => 1.5).length > 10);
});
