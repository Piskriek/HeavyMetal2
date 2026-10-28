// Plan 57 §10: the grid room climbs the stage ladder as the presets warm, rung by rung, and draws only when something changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EGA_PALETTE, RUNGS, frameDue, hexToRgb, roomFrameCap, roomStageAt, rungsWarm, warmShare, type WarmJob } from './grid-room-warm';

const JOBS: WarmJob[] = [
  { rung: 'atoms', label: 'a', weight: 1 },
  { rung: 'atoms', label: 'a', weight: 1 },
  { rung: 'stacks', label: 's', weight: 4 },
  { rung: 'parts', label: 'p', weight: 2 },
  { rung: 'assemblies', label: 'x', weight: 1 },
  { rung: 'worlds', label: 'w', weight: 1 },
];

test('the room climbs wireframe, 1-bit, EGA, VGA and reaches Gouraud only when everything is warm', () => {
  const stages = JOBS.map((_, i) => roomStageAt(warmShare(JOBS, i)));
  assert.equal(stages[0], '0a');
  assert.equal(roomStageAt(warmShare(JOBS, JOBS.length)), '3');
  // in order, never back down
  const order = ['0a', '0b', '1', '2', '3'];
  for (let i = 1; i <= JOBS.length; i++) assert.ok(order.indexOf(roomStageAt(warmShare(JOBS, i))) >= order.indexOf(roomStageAt(warmShare(JOBS, i - 1))));
  assert.equal(roomStageAt(0.999), '2', 'not stage 3 until the last job');
  assert.equal(warmShare([], 0), 1);
  assert.equal(warmShare(JOBS, 99), 1);
});

test('a rung\'s plinth fills only when its every job is done', () => {
  assert.deepEqual([...rungsWarm(JOBS, 1)], []);
  assert.deepEqual([...rungsWarm(JOBS, 2)], ['atoms']);
  assert.deepEqual([...rungsWarm(JOBS, 4)], ['atoms', 'stacks', 'parts']);
  assert.deepEqual([...rungsWarm(JOBS, JOBS.length)], [...RUNGS]);
  assert.ok(!rungsWarm(JOBS.filter((j) => j.rung !== 'worlds'), 99).has('worlds'), 'a rung with no jobs never shows warm');
});

test('it draws under its cap: 30 on the light tiers, 60 otherwise', () => {
  assert.equal(roomFrameCap('potato'), 30);
  assert.equal(roomFrameCap('low'), 30);
  assert.equal(roomFrameCap('high'), 60);
  assert.ok(!frameDue(1010, 1000, 30));
  assert.ok(frameDue(1032, 1000, 30));
  assert.ok(frameDue(1015, 1000, 60), 'a 60 Hz frame is never skipped');
});

test('the EGA palette is the hardware\'s 16, written as display values', () => {
  assert.equal(EGA_PALETTE.length, 16);
  assert.equal(new Set(EGA_PALETTE).size, 16);
  assert.deepEqual(hexToRgb('#55ffff'), [0x55 / 255, 1, 1]);
  assert.deepEqual(hexToRgb('#aa5500'), [0xaa / 255, 0x55 / 255, 0]);
});
