// The heavy machines are built with basegear's materials in the game: the two LabMaterials must stay compatible.
import test from 'node:test'; import assert from 'node:assert/strict';
import { createMaterials } from '@hm/basegear';
import { heavyPress, heavyProjector, heavyWater, triangles } from '../src/index';

test('heavy machines build with basegear materials', () => {
  const m = createMaterials();
  for (const build of [heavyPress, heavyProjector, heavyWater]) for (const stage of [1, 6]) assert.ok(triangles(build(m, { stage })) > 0);
});
