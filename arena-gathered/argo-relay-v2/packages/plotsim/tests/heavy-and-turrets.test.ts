import test from 'node:test';
import assert from 'node:assert/strict';
import { canPlaceHeavyTerraformerOnSocket } from '../src/heavy-terraformers';
import { stepPerimeterDefenseTurret } from '../src/perimeter-turret';

test('enforces 2x2 hardpoint for Heavy Terraformers and prioritizes sapper targets', () => {
  assert.equal(canPlaceHeavyTerraformerOnSocket('heavy-water-maker', 1, 1, true, 100).canPlace, false);
  assert.equal(canPlaceHeavyTerraformerOnSocket('heavy-water-maker', 2, 2, true, 100).canPlace, true);

  const res = stepPerimeterDefenseTurret(
    { id: 't1', x: 0, y: 0, z: 0, cooldownRemainingSec: 0 },
    0.1,
    1.0,
    [
      { id: 'swarmer-1', archetype: 'swarmer', x: 10, y: 0, z: 0, hp: 20 },
      { id: 'sapper-1', archetype: 'sapper', x: 18, y: 0, z: 0, hp: 30 },
    ]
  );
  assert.equal(res.targetEntityId, 'sapper-1');
});
