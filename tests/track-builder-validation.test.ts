import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import { classifyPlacedRamp, getTrackSpace, type RampLikeProp } from '../src/game/track-space';

// Headless verification of the T03 required decision: gameplay (ramp) props
// that cannot compile to a physical surface are rejected by the 3D builder
// instead of silently diverging between collision and rendering.

function makeBuilder() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100000);
  const builder = new TrackBuilder3D(scene, camera, {} as any);
  return builder as any;
}

function seedRampProp(builder: any, at: { x: number; y: number; z: number; trackDist: number }) {
  const prop = {
    id: 'ramp-test-1', type: 'timber_ramp', x: at.x, y: at.y, z: at.z,
    rotY: 0, scale: 1, trackDist: at.trackDist,
  };
  builder.placedProps.push(prop);
  return prop;
}

test('builder rejects ramp moves off the ribbon without applying them', () => {
  const builder = makeBuilder();
  const space = getTrackSpace();
  const s = 3000;
  const frame = space.frameAt(s);
  const prop = seedRampProp(builder, {
    x: Math.round(frame.pos.x), y: Math.round(frame.pos.y), z: Math.round(frame.pos.z), trackDist: s,
  });

  let notifies = 0;
  builder.onChange(() => { notifies += 1; });
  assert.equal(builder.getPlacementError(), null);

  // Teleport the ramp 50k units away from any track sheet: projection must fail
  builder.updatePropTransform(prop.id, { x: prop.x + 50000, y: prop.y + 50000, z: prop.z + 50000 });
  assert.ok(builder.getPlacementError(), 'placement error surfaced');
  assert.match(builder.getPlacementError()!, /not physical/i);
  const moved = builder.getProps().find((p: any) => p.id === prop.id);
  assert.equal(moved.x, prop.x, 'rejected transform not applied');
  assert.equal(moved.y, prop.y);
  assert.ok(notifies > 0, 'UI notified of the rejection');

  builder.clearPlacementError();
  assert.equal(builder.getPlacementError(), null);
});

test('builder rejects ramp placement into a loop window', () => {
  const builder = makeBuilder();
  const space = getTrackSpace();
  const loop = space.loops[0];
  assert.ok(loop, 'course has loops');
  const mid = (loop.start + loop.end) / 2;
  const frame = space.frameAt(mid);
  const prop = seedRampProp(builder, {
    x: Math.round(frame.pos.x), y: Math.round(frame.pos.y), z: Math.round(frame.pos.z), trackDist: mid,
  });
  builder.updatePropTransform(prop.id, { x: prop.x + 1 });
  assert.ok(builder.getPlacementError(), 'loop-region ramp rejected');
  assert.match(builder.getPlacementError()!, /loop|physical/i);
});

test('non-ramp props are never gated; ramp classification spans all ramp types', () => {
  const builder = makeBuilder();
  const nonRamp = { id: 'tree-1', type: 'boulder_a', x: 0, y: 0, z: 0, rotY: 0, scale: 1 };
  builder.placedProps.push(nonRamp);
  builder.updatePropTransform(nonRamp.id, { x: 99999, y: 99999, z: 99999 });
  const moved = builder.getProps().find((p: any) => p.id === nonRamp.id);
  assert.equal(moved.x, 99999, 'non-ramp prop moved freely (scenery is visual-only)');
  assert.equal(builder.getPlacementError(), null);

  const space = getTrackSpace();
  const frame = space.frameAt(3000);
  const prop = seedRampProp(builder, { x: frame.pos.x, y: frame.pos.y, z: frame.pos.z, trackDist: 3000 });
  // sanity: seeded straight-run ramp classifies as physical (what the gate checks against)
  const verdict = classifyPlacedRamp(space, prop as RampLikeProp);
  assert.equal(verdict.supported, true, `straight-run ramp supported (${verdict.reason ?? ''})`);
});
