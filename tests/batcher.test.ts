import test from 'node:test';
import assert from 'node:assert/strict';
import { planBatches, MIN_INSTANCES_PER_BATCH } from '../src/game/bake/batcher';
import type { PlacedProp } from '../src/game/track-builder-3d';

test('T8 Batcher: min instances threshold and chunking', () => {
  const props: PlacedProp[] = [
    // 4 trees in chunk 0 (x ∈ [0, 3000)) -> should batch!
    { id: 't1', type: 'pine', name: 'Pine', x: 100, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false },
    { id: 't2', type: 'pine', name: 'Pine', x: 200, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false },
    { id: 't3', type: 'pine', name: 'Pine', x: 300, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false },
    { id: 't4', type: 'pine', name: 'Pine', x: 400, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false },

    // 2 rocks in chunk 0 (< 3 instances) -> remains unbatched!
    { id: 'r1', type: 'rock', name: 'Rock', x: 500, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false },
    { id: 'r2', type: 'rock', name: 'Rock', x: 600, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false },

    // 1 animated sheet -> excluded from batching!
    { id: 'a1', type: 'torch', name: 'Torch', x: 700, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false, animate: true },
  ];

  const plan = planBatches(props);

  assert.equal(plan.batches.length, 1);
  assert.equal(plan.batches[0].props.length, 4);
  assert.equal(plan.totalBatchedProps, 4);
  assert.equal(plan.unbatched.length, 3);
  assert.equal(plan.drawCallEstimate, 4); // 1 batch + 3 unbatched = 4 draws (down from 7)
});

test('T8 Batcher: chunked bounding sphere covers member extents', () => {
  const props: PlacedProp[] = [
    { id: 'p1', type: 'boulder', name: 'Boulder', x: 1000, y: 10, z: 20, rotY: 0, scale: 1, alignToTrack: false },
    { id: 'p2', type: 'boulder', name: 'Boulder', x: 1500, y: 20, z: 80, rotY: 0, scale: 1, alignToTrack: false },
    { id: 'p3', type: 'boulder', name: 'Boulder', x: 2000, y: 30, z: 120, rotY: 0, scale: 1, alignToTrack: false },
  ];

  const plan = planBatches(props);
  assert.equal(plan.batches.length, 1);

  const sphere = plan.batches[0].boundingSphere;
  assert.ok(sphere.centerX >= 1000 && sphere.centerX <= 2000);
  assert.ok(sphere.radius >= 500);
});
