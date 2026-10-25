// VEH-02: steer -1 turns the rover left (toward -x, negative yaw rate), +1 turns it right (toward +x, positive yaw rate).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, step, type Ground, type RoverState, type Input, type RoverKind } from '../src/index';

const flat: Ground = { height: () => 0, g: 1.62 };
const run = (s: RoverState, i: Input, n: number) => { for (let k = 0; k < n; k++) s = step(s, i, flat); return s; };
const idle: Input = { throttle: 0, steer: 0, brake: false };

for (const kind of ['scout', 'hauler'] as const satisfies readonly RoverKind[]) {
  test(`${kind}: steer -1 turns left (negative yaw rate toward -x), +1 turns right (positive yaw rate toward +x)`, () => {
    const rolling = run(spawn(kind, 0, 0, [0, 1], flat), idle, 120);
    const left = run(rolling, { throttle: 0.6, steer: -1, brake: false }, 60);
    const right = run(rolling, { throttle: 0.6, steer: 1, brake: false }, 60);
    assert.ok(left.w[1] < 0, `${kind} steer -1 yaw rate ${left.w[1]}`);
    assert.ok(right.w[1] > 0, `${kind} steer +1 yaw rate ${right.w[1]}`);
  });
}
