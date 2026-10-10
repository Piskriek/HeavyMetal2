// In the game the openings kit is built with @hm/basekit's materials, so both kits read as one family.
import test from 'node:test'; import assert from 'node:assert/strict';
import { createMaterials } from '@hm/basekit';
import { halfWall, windowWall, doorframe, door, railing, ladder, stairs, lifeSupport, triangles } from '../src/index';

test('the openings kit builds with basekit materials', () => {
  const m = createMaterials();
  for (const build of [halfWall, windowWall, doorframe, door, railing, ladder, stairs, lifeSupport]) for (const stage of [1, 6]) assert.ok(triangles(build(m, { stage })) > 0);
});
