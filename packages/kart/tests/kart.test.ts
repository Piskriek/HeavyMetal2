import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_KART, forwardSpeed, spawnKart, stepKart } from '../src/index';
const flat = { heightAt: () => 0 };
const run = (steps: number, input: { throttle: number; steer: number; brake: boolean }) => { let s = spawnKart([0, 0, 0], 0); for (let i = 0; i < steps; i++) s = stepKart(s, input, 0.05, flat); return s; };
test('full throttle reaches but never passes max speed, straight along +z', () => {
  const s = run(100, { throttle: 1, steer: 0, brake: false });
  assert.ok(Math.abs(forwardSpeed(s) - DEFAULT_KART.maxSpeed) < 1e-6);
  assert.ok(s.pos[2] > 40 && Math.abs(s.pos[0]) < 1e-9);
  assert.equal(s.onGround, true);
});
test('after 1 s of throttle it goes 8 m/s', () => {
  assert.ok(Math.abs(forwardSpeed(run(20, { throttle: 1, steer: 0, brake: false })) - 8) < 1e-6);
});
test('no turning while standing; steering right turns yaw up while moving', () => {
  assert.equal(run(10, { throttle: 0, steer: 1, brake: false }).yaw, 0);
  assert.ok(run(30, { throttle: 1, steer: 1, brake: false }).yaw > 0);
});

test('braking brings the kart to a stop without reversing', () => {
  let s = run(20, { throttle: 1, steer: 0, brake: false });
  for (let i = 0; i < 20; i++) {
    s = stepKart(s, { throttle: 0, steer: 0, brake: true }, 0.05, flat);
  }
  assert.ok(Math.abs(forwardSpeed(s)) < 1e-9);
});

test('reverse speed is capped at 40 percent of max speed', () => {
  let s = spawnKart([0, 0, 0], 0);
  for (let i = 0; i < 100; i++) {
    s = stepKart(s, { throttle: -1, steer: 0, brake: false }, 0.05, flat);
  }
  assert.ok(Math.abs(forwardSpeed(s) + DEFAULT_KART.maxSpeed * 0.4) < 1e-9);
});

test('low grip preserves sideways drift', () => {
  const start = spawnKart([0, 0, 0], 0);
  start.vel = [4, 0, 8];
  const input = { throttle: 0, steer: 0, brake: false };
  const lowGrip = stepKart(start, input, 0.05, flat, { ...DEFAULT_KART, grip: 0 });
  const highGrip = stepKart(start, input, 0.05, flat, { ...DEFAULT_KART, grip: 1 });

  assert.ok(lowGrip.vel[0] > 0);
  assert.equal(highGrip.vel[0], 0);
  assert.ok(lowGrip.pos[0] > highGrip.pos[0]);
});

test('a ramp drop launches the kart and it lands', () => {
  const ramp = { heightAt: (_x: number, z: number) => (z < 2 ? 0 : -1) };
  let s = spawnKart([0, 0, 0], 0);
  let wentAirborne = false;
  let landed = false;

  for (let i = 0; i < 100; i++) {
    s = stepKart(s, { throttle: 1, steer: 0, brake: false }, 0.05, ramp);
    if (!s.onGround) wentAirborne = true;
    else if (wentAirborne) landed = true;
  }

  assert.equal(wentAirborne, true);
  assert.equal(landed, true);
  assert.equal(s.onGround, true);
  assert.equal(s.pos[1], -1);
  assert.equal(s.airTime, 0);
});

test('water halves the maximum speed', () => {
  const water = { heightAt: () => 0, isWater: () => true };
  let s = spawnKart([0, 0, 0], 0);
  for (let i = 0; i < 100; i++) {
    s = stepKart(s, { throttle: 1, steer: 0, brake: false }, 0.05, water);
  }
  assert.ok(Math.abs(forwardSpeed(s) - DEFAULT_KART.maxSpeed * 0.5) < 1e-9);
});

test('a long step matches equivalent 0.05 second steps', () => {
  const input = { throttle: 0.7, steer: 0.4, brake: false };
  const start = spawnKart([0, 0, 0], 0);
  const combined = stepKart(start, input, 0.2, flat);
  let split = start;

  for (let i = 0; i < 4; i++) {
    split = stepKart(split, input, 0.05, flat);
  }

  assert.ok(Math.abs(combined.pos[0] - split.pos[0]) < 1e-10);
  assert.ok(Math.abs(combined.pos[1] - split.pos[1]) < 1e-10);
  assert.ok(Math.abs(combined.pos[2] - split.pos[2]) < 1e-10);
  assert.ok(Math.abs(combined.vel[0] - split.vel[0]) < 1e-10);
  assert.ok(Math.abs(combined.vel[1] - split.vel[1]) < 1e-10);
  assert.ok(Math.abs(combined.vel[2] - split.vel[2]) < 1e-10);
  assert.ok(Math.abs(combined.yaw - split.yaw) < 1e-10);
});