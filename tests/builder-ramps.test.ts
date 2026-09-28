/**
 * Builder-placed ramps are physics: a placed timber ramp launches the ball instead of the renderer
 * lifting it and dropping it back on the road at the crest (which read as a reset).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRampSurfaces, getTrackSpace } from '../src/game/track-space';
import { builderRampObstacles } from '../src/game/sim/builder-ramps';
import { createRacers, type Racer } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { RADIUS, courseY, laneZ } from '../src/game/scene';

// The user's own early timber ramp, from backups/props/track-props-latest.json.
const PLACED = { id: 'prop_1790059298577_lm0y', x: 361, y: 17686, z: 1777, rotY: 0, scale: 0.55, trackDist: 4400 };

test('a placed ramp compiles to an engine ramp obstacle on the lanes it covers', () => {
  const map = getTrackSpace();
  const { surfaces, rejected } = compileRampSurfaces(map, [PLACED]);
  assert.equal(rejected.length, 0, rejected.map((r) => r.detail).join('; '));
  const ramps = builderRampObstacles(map, surfaces);
  assert.ok(ramps.length >= 1 && ramps.length <= 4, `${ramps.length} lanes`);
  for (const ramp of ramps) {
    assert.equal(ramp.kind, 'ramp');
    assert.equal(ramp.laneSpan, 1, 'one lane each, like the layout ramps');
    assert.ok(ramp.width > 50 && ramp.height > 50, `w ${ramp.width} h ${ramp.height}`);
  }
  assert.equal(new Set(ramps.map((r) => r.lane)).size, ramps.length, 'no lane twice');
});

test('crossing a placed ramp keeps forward speed and launches the ball (no reset)', () => {
  const map = getTrackSpace();
  const [ramp] = builderRampObstacles(map, compileRampSurfaces(map, [PLACED]).surfaces);
  const world = createSimWorld('ridge', [ramp], []);
  const lane = ramp.lane!;
  const startX = ramp.x - 400;
  const racer: Racer = { ...createRacers()[0], lane, targetLane: lane, z: laneZ(lane), x: startX, y: courseY(startX, 'ridge') - RADIUS, vx: 900, vy: 0, grounded: true };
  let t = 0;
  const ctx: RacerStepContext = { world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5, get runTime() { return t; }, get wallTime() { return t; } };
  let entryVx = 0; let launched = false; let recovered = false; let maxLift = 0;
  for (let i = 0; i < 600 && racer.x < ramp.x + ramp.width + 600; i++) {
    t += FIXED_STEP;
    if (entryVx === 0 && racer.x >= ramp.x) entryVx = racer.vx;
    const before = racer.recoveries;
    stepRacer(racer, ctx, FIXED_STEP);
    if (racer.recoveries !== before) recovered = true;
    maxLift = Math.max(maxLift, courseY(racer.x, 'ridge') - RADIUS - racer.y);
    if (racer.x > ramp.x + ramp.width && !racer.grounded && racer.vy < 0) launched = true;
    if (racer.x > ramp.x + ramp.width && !launched) break;
  }
  assert.ok(entryVx > 0, 'reached the ramp');
  assert.ok(launched, 'left the crest airborne and rising');
  assert.equal(recovered, false, 'no recovery/reset fired');
  assert.ok(maxLift > ramp.height * 0.8, `rose above the road (${maxLift.toFixed(0)} vs ramp ${ramp.height.toFixed(0)})`);
  // Climbing costs some speed (gravity), but nothing like a stop: at least 60 % survives the crest.
  assert.ok(racer.vx >= entryVx * 0.6, `kept speed: ${racer.vx.toFixed(0)} vs entry ${entryVx.toFixed(0)}`);
});

test('the engine adds builder ramps to the physics world', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /builderRampObstacles\(map, compiled\.surfaces\)/);
  assert.match(engine, /const placed = this\.builderRamps\(\);/);
});
