// Plan 50 §6: the game screen stands on its own base: nothing floats, and the picture sits inside the bezel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, sourceBounds, transformBox, validate } from '@hm/kitspec';
import { GAME_SCREEN_KIT, GAME_SCREEN_SURFACE } from './kit-game-screen';

test('the game screen passes the kit audit and its picture fits inside the bezel', () => {
  assert.deepEqual(validate(GAME_SCREEN_KIT, 'game-screen'), []);
  const placed = flatten(GAME_SCREEN_KIT, 'game-screen');
  const box = (path: string) => {
    const p = placed.find((q) => q.path === path)!;
    return transformBox(sourceBounds(p.source), p.matrix);
  };
  const top = box('bezel-top'), bottom = box('bezel-bottom'), left = box('bezel-left'), right = box('bezel-right');
  const [cx, cy] = GAME_SCREEN_SURFACE.centre;
  assert.ok(cy - GAME_SCREEN_SURFACE.height / 2 >= bottom.max[1] - 1e-9 && cy + GAME_SCREEN_SURFACE.height / 2 <= top.min[1] + 1e-9);
  assert.ok(cx - GAME_SCREEN_SURFACE.width / 2 >= right.max[0] - 1e-9 && cx + GAME_SCREEN_SURFACE.width / 2 <= left.min[0] + 1e-9);
});
