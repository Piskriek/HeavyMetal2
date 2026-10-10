import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as THREE from 'three';
import { KitPieceCache } from './kit-pieces';
import type { Kind } from '@hm/structure';

test('kitPiece pivot frames, bounding boxes and colliders at stage 1 and stage 6', () => {
  const cache = new KitPieceCache();
  const kinds: Kind[] = [
    'foundation',
    'wall',
    'pillar',
    'floor',
    'ramp',
    'airlock',
    'hardpoint',
    'bin',
    'bench',
    'repeater',
  ];

  for (const stage of [1, 6]) {
    for (const kind of kinds) {
      const piece = cache.getTemplate(kind, stage, 1);
      assert.ok(piece.colliders.length > 0, `${kind} stage ${stage} colliders must be non-empty`);

      const box = new THREE.Box3().setFromObject(piece.group);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Check cell kinds
      if (kind === 'foundation' || kind === 'floor') {
        assert.ok(Math.abs(box.min.x) <= 2.35, `${kind} s${stage} min.x (${box.min.x}) <= 2.35`);
        assert.ok(Math.abs(box.max.x) <= 2.35, `${kind} s${stage} max.x (${box.max.x}) <= 2.35`);
        assert.ok(Math.abs(box.min.z) <= 2.35, `${kind} s${stage} min.z (${box.min.z}) <= 2.35`);
        assert.ok(Math.abs(box.max.z) <= 2.35, `${kind} s${stage} max.z (${box.max.z}) <= 2.35`);
      } else if (kind === 'ramp') {
        assert.ok(Math.abs(box.min.x) <= 2.35, `${kind} s${stage} min.x (${box.min.x}) <= 2.35`);
        assert.ok(Math.abs(box.max.x) <= 2.35, `${kind} s${stage} max.x (${box.max.x}) <= 2.35`);
        assert.ok(Math.abs(box.min.z) <= 2.7, `${kind} s${stage} min.z (${box.min.z}) <= 2.7`);
        assert.ok(Math.abs(box.max.z) <= 2.35, `${kind} s${stage} max.z (${box.max.z}) <= 2.35`);
      }

      // Check wall and airlock
      if (kind === 'wall' || kind === 'airlock') {
        assert.ok(Math.abs(box.min.x) <= 2.1, `${kind} s${stage} min.x (${box.min.x}) <= 2.1`);
        assert.ok(Math.abs(box.max.x) <= 2.1, `${kind} s${stage} max.x (${box.max.x}) <= 2.1`);
        assert.ok(Math.abs(box.min.z) <= 0.25, `${kind} s${stage} min.z (${box.min.z}) <= 0.25`);
        assert.ok(Math.abs(box.max.z) <= 0.25, `${kind} s${stage} max.z (${box.max.z}) <= 0.25`);
      }

      // Check hardpoint
      if (kind === 'hardpoint') {
        assert.ok(Math.abs(box.min.x) <= 4.4, `hardpoint s${stage} min.x (${box.min.x}) <= 4.4`);
        assert.ok(Math.abs(box.max.x) <= 4.4, `hardpoint s${stage} max.x (${box.max.x}) <= 4.4`);
        assert.ok(Math.abs(box.min.z) <= 4.4, `hardpoint s${stage} min.z (${box.min.z}) <= 4.4`);
        assert.ok(Math.abs(box.max.z) <= 4.4, `hardpoint s${stage} max.z (${box.max.z}) <= 4.4`);
      }

      // Check fixtures center
      if (kind === 'bin' || kind === 'bench' || kind === 'repeater') {
        assert.ok(Math.abs(center.x) <= 0.3, `${kind} s${stage} center.x (${center.x}) <= 0.3`);
        assert.ok(Math.abs(center.z) <= 0.3, `${kind} s${stage} center.z (${center.z}) <= 0.3`);
      }

      // Every kind except foundation and floor: min.y >= -0.05
      if (kind !== 'foundation' && kind !== 'floor') {
        assert.ok(box.min.y >= -0.05, `${kind} s${stage} min.y (${box.min.y}) >= -0.05`);
      }
    }
  }

  cache.dispose();
});
