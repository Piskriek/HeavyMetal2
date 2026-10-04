import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYS_MATERIALS, bodyFor, hammer, materialById, stepBody, type Body, type Motion } from '../src/index';
const sim = (b: Body, m: Motion, seconds: number): Motion => { let cur = m; for (let i = 0; i < seconds * 120; i++) cur = stepBody(b, cur, 1 / 120, 0); return cur; };

test('materials are legal and the anvil is heavy', () => {
  for (const id of ['wood', 'rubber', 'ice', 'metal', 'anvil', 'balloon', 'cork', 'stone', 'jelly']) assert.equal(materialById(id).id, id);
  assert.equal(materialById('nope').id, 'wood');
  for (const p of PHYS_MATERIALS) assert.ok(p.bounce >= 0 && p.bounce <= 1 && p.friction >= 0 && p.friction <= 1 && p.drag >= 0 && p.drag <= 1 && p.lift >= -1 && p.lift <= 1.5 && p.density > 0, p.id);
  assert.ok(Math.abs(materialById('anvil').density - 10000) < 1);
});
test('a near-cube becomes a sphere, a plank a box', () => {
  assert.equal(bodyFor([0, 0, 0], [1, 1.1, 1], 'wood', 'solid', true).shape, 'sphere');
  const plank = bodyFor([0, 0, 0], [4, 0.2, 1], 'wood', 'solid', true);
  assert.equal(plank.shape, 'box'); assert.ok(Math.abs(plank.mass - 600 * 4 * 0.2 * 1) < 1e-6);
});
test('rubber bounces high, stone hardly, a balloon floats up, ghosts stay', () => {
  const ball = (mat: string): Body => bodyFor([-0.5, 0, -0.5], [0.5, 1, 0.5], mat, 'solid', true);
  const peak = (mat: string): number => { let cur: Motion = { pos: [0, 5, 0], vel: [0, 0, 0] }, top = 0, landed = false;
    for (let i = 0; i < 600; i++) { cur = stepBody(ball(mat), cur, 1 / 120, 0); if (cur.vel[1] > 0) landed = true; if (landed) top = Math.max(top, cur.pos[1]); } return top; };
  assert.ok(peak('rubber') > 3); assert.ok(peak('stone') < 1);
  assert.ok(sim(ball('balloon'), { pos: [0, 1, 0], vel: [0, 0, 0] }, 1).pos[1] > 1.5);
  assert.deepEqual(sim({ ...ball('wood'), solidity: 'ghost' }, { pos: [0, 5, 0], vel: [0, 0, 0] }, 1).pos, [0, 5, 0]);
});
test('ice slides much farther than wood', () => {
  const slide = (mat: string): number => sim(bodyFor([0, 0, 0], [1, 0.2, 1], mat, 'solid', true), { pos: [0, 0, 0], vel: [5, 0, 0] }, 3).pos[0];
  assert.ok(slide('ice') > 3 * slide('wood'));
});
test('the hammer pushes near things away and leaves far ones', () => {
  const b = bodyFor([0, 0, 0], [1, 1, 1], 'wood', 'solid', true);
  const v = hammer([0, 0, 0], 5, 1, [{ body: b, motion: { pos: [2, 0, 0], vel: [0, 0, 0] } }, { body: b, motion: { pos: [9, 0, 0], vel: [0, 0, 0] } }]);
  assert.ok(v[0]![0] > 0 && v[0]![1] > 0 && Math.abs(v[0]![2]) < 1e-9); assert.deepEqual(v[1], [0, 0, 0]);
});

test('static bodies do not move and contact clamps the body to its resting height', () => {
  const box = bodyFor([0, 0, 0], [2, 2, 2], 'wood', 'solid', false);
  assert.deepEqual(stepBody(box, { pos: [1, 4, 1], vel: [2, -3, 1] }, 1, 0), { pos: [1, 4, 1], vel: [2, -3, 1] });
  const falling = { ...box, dynamic: true };
  const landed = stepBody(falling, { pos: [0, 1, 0], vel: [0, -1, 0] }, 1, 0);
  assert.equal(landed.pos[1], falling.radius);
});

test('the hammer respects dynamic state and impulse falloff', () => {
  const b = bodyFor([0, 0, 0], [1, 1, 1], 'wood', 'solid', true);
  const staticBody = { ...b, dynamic: false };
  const velocities = hammer([0, 0, 0], 10, 2, [
    { body: b, motion: { pos: [1, 0, 0], vel: [1, 0, 0] } },
    { body: b, motion: { pos: [8, 0, 0], vel: [1, 0, 0] } },
    { body: staticBody, motion: { pos: [1, 0, 0], vel: [1, 0, 0] } },
  ]);
  assert.ok(velocities[0]![0] > velocities[1]![0]);
  assert.deepEqual(velocities[2], [1, 0, 0]);
});