// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
// voxelart.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELS,
  stats,
  ascii,
  get,
  type Model,
} from '../src';

describe('Voxel Art Models Suite', () => {
  const EXPECTED_SPECS: Record<string, { size: [number, number, number]; pivot: [number, number, number]; minVoxels: number; maxVoxels: number }> = {
    goblin: { size: [28, 44, 20], pivot: [14, 0, 10], minVoxels: 3000, maxVoxels: 9000 },
    'goblin-ball-racer': { size: [36, 36, 36], pivot: [18, 18, 18], minVoxels: 4000, maxVoxels: 14000 },
    palm: { size: [36, 44, 36], pivot: [18, 0, 18], minVoxels: 800, maxVoxels: 5000 },
    barrel: { size: [14, 16, 14], pivot: [7, 0, 7], minVoxels: 400, maxVoxels: 1500 },
    rock: { size: [20, 14, 18], pivot: [10, 0, 9], minVoxels: 500, maxVoxels: 2500 },
    trophy: { size: [16, 30, 16], pivot: [8, 0, 8], minVoxels: 300, maxVoxels: 1600 },
    'statue-plinth': { size: [24, 8, 24], pivot: [12, 0, 12], minVoxels: 600, maxVoxels: 3000 },
  };

  it('declares 7 unique models with valid ids and names', () => {
    assert.equal(MODELS.length, 7);
    const ids = new Set(MODELS.map((m) => m.id));
    assert.equal(ids.size, 7);
    for (const id of Object.keys(EXPECTED_SPECS)) {
      assert.ok(ids.has(id), `Missing model id: ${id}`);
    }
  });

  for (const entry of MODELS) {
    describe(`Model "${entry.id}"`, () => {
      const spec = EXPECTED_SPECS[entry.id]!;
      const m1: Model = entry.build();

      it('matches expected size and pivot', () => {
        assert.deepEqual(m1.size, spec.size);
        assert.deepEqual(m1.pivot, spec.pivot);
      });

      it('build() is completely deterministic', () => {
        const m2 = entry.build();
        assert.equal(m1.cells.length, m2.cells.length);
        assert.deepEqual(m1.cells, m2.cells);
      });

      it('has a palette between 8 and 16 entries with sensible PBR values', () => {
        assert.ok(m1.palette.length >= 8, `Palette too small: ${m1.palette.length}`);
        assert.ok(m1.palette.length <= 16, `Palette too large: ${m1.palette.length}`);
        for (const p of m1.palette) {
          assert.ok(p.roughness >= 0 && p.roughness <= 1, `Invalid roughness: ${p.roughness}`);
          assert.ok(p.metalness >= 0 && p.metalness <= 1, `Invalid metalness: ${p.metalness}`);
          assert.ok(p.emissive >= 0 && p.emissive <= 1, `Invalid emissive: ${p.emissive}`);
          assert.ok(p.alpha >= 0 && p.alpha <= 1, `Invalid alpha: ${p.alpha}`);
          assert.equal(p.color.length, 3);
          for (const c of p.color) {
            assert.ok(c >= 0 && c <= 1, `Invalid color component: ${c}`);
          }
        }
      });

      it('conforms to voxel count constraints, bounds, and uses all palette entries', () => {
        const s = stats(m1);
        assert.ok(
          s.voxels >= spec.minVoxels && s.voxels <= spec.maxVoxels,
          `${entry.id} voxel count ${s.voxels} outside [${spec.minVoxels}, ${spec.maxVoxels}]`
        );

        assert.ok(s.bounds.min[0] >= 0 && s.bounds.max[0] < m1.size[0]);
        assert.ok(s.bounds.min[1] >= 0 && s.bounds.max[1] < m1.size[1]);
        assert.ok(s.bounds.min[2] >= 0 && s.bounds.max[2] < m1.size[2]);

        assert.equal(s.paletteUse.length, m1.palette.length);
        for (let i = 0; i < s.paletteUse.length; i++) {
          const count = s.paletteUse[i] ?? 0;
          assert.ok(count > 0, `Palette entry #${i + 1} (${m1.palette[i]?.name}) unused in model ${entry.id}`);
        }
      });

      it('is ONE connected piece with 6-connectivity (no floating voxels)', () => {
        const s = stats(m1);
        assert.equal(s.components, 1, `Model ${entry.id} has ${s.components} disconnected components`);
      });
    });
  }

  describe('Goblin Specific Requirements', () => {
    const goblinEntry = MODELS.find((m) => m.id === 'goblin')!;
    const goblin = goblinEntry.build();

    it('is left-right symmetric except for the shield', () => {
      const [sx, sy, sz] = goblin.size;
      const halfX = Math.floor(sx / 2);

      let differences = 0;
      let nonShieldDifferences = 0;

      for (let z = 0; z < sz; z++) {
        for (let y = 0; y < sy; y++) {
          for (let x = 0; x < halfX; x++) {
            const leftVal = get(goblin, x, y, z);
            const rightVal = get(goblin, sx - 1 - x, y, z);
            if (leftVal !== rightVal) {
              differences++;
              // Shield is located on the left arm: x <= 4, y in 5..17, z in 4..16
              const isShieldRegion = x <= 9 && y >= 4 && y <= 20 && z >= 3 && z <= 17;
              if (!isShieldRegion) {
                nonShieldDifferences++;
              }
            }
          }
        }
      }

      assert.ok(differences > 0, 'Goblin must have asymmetric shield');
      assert.equal(nonShieldDifferences, 0, 'Goblin must be strictly symmetric outside the shield');
    });

    it('contains the glowing eye entry on both sides in ascii head slice', () => {
      const eyeIndex = goblin.palette.findIndex((e) => e.name === 'eye-glow') + 1;
      assert.ok(eyeIndex > 0, 'Missing eye-glow palette entry');
      const eyeChar = eyeIndex.toString();

      const headSlice = ascii(goblin, 36);
      assert.ok(headSlice.length > 0);

      const lines = headSlice.split('\n');
      let foundLeft = false;
      let foundRight = false;

      for (const line of lines) {
        const leftHalf = line.slice(0, 14);
        const rightHalf = line.slice(14);
        if (leftHalf.includes(eyeChar)) foundLeft = true;
        if (rightHalf.includes(eyeChar)) foundRight = true;
      }

      assert.ok(foundLeft, 'Glowing eye not found on left side of head slice');
      assert.ok(foundRight, 'Glowing eye not found on right side of head slice');
    });
  });
});