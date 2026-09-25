/**
 * H8: a hit on the player's ball is felt three ways, all scaled by the impact: the camera kicks away
 * from the side it came from, the yoke jolts and recovers in ~180 ms, and the hull thuds. Reduced
 * motion keeps a tenth of the kick and swaps the yoke's shudder for a flash.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KICK_MAX_OFFSET, KICK_REDUCED_SHARE, KICK_SECONDS, cameraKick, impactEnvelope } from '../src/game/camera-shake';
import { JOLT_MAX_DEG, JOLT_MAX_DROP_PX, createCockpitState, fillCockpitState, yokeJolt } from '../src/game/cockpit';
import { THUD } from '../src/game/audio';
import { INITIAL_SNAPSHOT } from '../src/game/types';

test('H8: the kick envelope is 1 at the hit and gone by 180 ms', () => {
  assert.equal(KICK_SECONDS, 0.18);
  assert.equal(impactEnvelope(0), 1);
  assert.ok(impactEnvelope(0.09) > 0 && impactEnvelope(0.09) < 1);
  assert.equal(impactEnvelope(KICK_SECONDS), 0);
  assert.equal(impactEnvelope(-0.01), 0, 'nothing before the hit');
  assert.equal(impactEnvelope(Number.NaN), 0);
  for (let t = 0; t < KICK_SECONDS; t += 0.01) assert.ok(impactEnvelope(t + 0.01) <= impactEnvelope(t), 'only ever settles');
});

test('H8: the camera is kicked away from the hit, by how hard it was', () => {
  const fromRight = cameraKick(1, 1, 0, false);
  assert.equal(fromRight.right, -KICK_MAX_OFFSET, 'a hit from the right throws the view left');
  assert.equal(cameraKick(-1, 1, 0, false).right, KICK_MAX_OFFSET, 'and from the left, right');
  assert.equal(cameraKick(0, 1, 0, false).right, 0, 'straight on only dips');
  assert.ok(cameraKick(0, 1, 0, false).up < 0);
  assert.ok(Math.abs(cameraKick(1, 0.3, 0, false).right) < Math.abs(fromRight.right), 'a light knock kicks less');
  assert.deepEqual(cameraKick(1, 1, KICK_SECONDS, false), { right: 0, up: 0, forward: 0 }, 'settled');
});

test('H8: reduced motion keeps a tenth of the kick', () => {
  const full = cameraKick(1, 1, 0, false); const reduced = cameraKick(1, 1, 0, true);
  assert.ok(Math.abs(reduced.right) <= Math.abs(full.right) * KICK_REDUCED_SHARE + 1e-9);
  assert.ok(Math.abs(reduced.right) > 0, 'felt, not a lurch');
});

test('H8: the yoke shudders and drops, then recovers; reduced motion flashes instead', () => {
  const jolt = yokeJolt(1, 1, 0, false);
  assert.equal(jolt.dropPx, JOLT_MAX_DROP_PX);
  assert.equal(jolt.rotDeg, -JOLT_MAX_DEG, 'the first swing is away from the hit');
  assert.equal(jolt.flash, 0);
  for (let t = 0; t < 1; t += 0.013) assert.ok(Math.abs(yokeJolt(0.5, -1, t, false).rotDeg) <= JOLT_MAX_DEG * 0.5 + 1e-9);
  assert.deepEqual(yokeJolt(0, 1, 0, false), { rotDeg: 0, dropPx: 0, flash: 0 }, 'recovered');
  assert.deepEqual(yokeJolt(0.6, 1, 0, true), { rotDeg: 0, dropPx: 0, flash: 0.6 }, 'reduced motion: still yoke, a flash');
});

test('H8: the cockpit channel carries the hit through fillCockpitState', () => {
  const state = createCockpitState();
  fillCockpitState(state, { ...INITIAL_SNAPSHOT, grade: 0, grounded: true, shieldSeconds: 0, raceTime: 0 } as never, 0, { amount: 0.7, side: -1 });
  assert.equal(state.impact, 0.7);
  assert.equal(state.impactSide, -1);
  fillCockpitState(state, { ...INITIAL_SNAPSHOT, grade: 0, grounded: true, shieldSeconds: 0, raceTime: 0 } as never, 0);
  assert.equal(state.impact, 0, 'no hit, no jolt');
});

test('H8: the thud is low and short, and the engine plays it scaled on every player hit', () => {
  assert.ok(THUD.fromHz <= 160 && THUD.toHz <= 40 && THUD.seconds <= 0.3 && THUD.lowpassHz <= 250);
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /this\.playerImpact\(Math\.max\(0\.25, closing \/ 380\), Math\.sign\(rival\.z - player\.z\)/, 'rival hits, by closing speed and side');
  assert.match(engine, /if \(amount >= 3\) engine\.playerImpact\(Math\.min\(1, amount \/ 9\), 0\)/, 'obstacle hits, straight on');
  assert.match(engine, /this\.audio\.play\('thud', 0\.35 \+ 0\.65 \* this\.impact\.strength\)/);
  const renderer = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(renderer, /cameraKick\(impact\.side, impact\.strength, time - impact\.at, reducedMotion\)/);
  const hud = readFileSync(new URL('../src/components/CockpitHud.tsx', import.meta.url), 'utf8');
  assert.match(hud, /yokeJolt\(state\.impact, state\.impactSide, now \/ 1000, reducedMotion\)/);
});
