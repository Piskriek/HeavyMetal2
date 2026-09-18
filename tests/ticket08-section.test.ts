/** TICKET-08 contracts for the expanded waterfall cliff section. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import {
  CLIFF_GRAVITY_MULTIPLIER, STAGE_2_END, STAGE_2_START, TRACK_DISTANCE,
  gravityScaleForSlope, surfaceTypeAt,
} from '../src/game/scene';
import { createStage2WaterfallSection } from '../src/game/track-layout';

const root = new URL('../', import.meta.url);
const asset = (name: string) => new URL(`public/art/track-parts/${name}`, root);

test('ticket08 expands the circuit to three 12 km stages', () => {
  assert.equal(TRACK_DISTANCE, 36000);
  assert.equal((STAGE_2_END - STAGE_2_START) / 2, 12000);
});

test('ticket08 applies cliff gravity only at the specified steep angle', () => {
  assert.equal(gravityScaleForSlope(Math.tan(39 * Math.PI / 180)), 1);
  assert.equal(gravityScaleForSlope(Math.tan(41 * Math.PI / 180)), CLIFF_GRAVITY_MULTIPLIER);
  assert.equal(surfaceTypeAt(STAGE_2_START + 100), 'wet_wood');
  assert.equal(surfaceTypeAt(STAGE_2_START + 9000), 'moss_rock');
});

for (const course of ['ridge', 'boomtown', 'sheep'] as const) {
  test(`ticket08 ${course} has a deterministic pinball cascade`, () => {
    const section = createStage2WaterfallSection(course);
    assert.ok(section.length >= 40);
    assert.ok(section.every((item) => item.section === 'stage2'));
    assert.ok(section.every((item) => item.x < STAGE_2_END));
    for (const kind of ['rock-bumper', 'spiked-rock', 'spring', 'fire-ring', 'loop', 'gap'] as const) {
      assert.ok(section.some((item) => item.kind === kind), `${course} has ${kind}`);
    }
    assert.ok(section.some((item) => item.kind === 'fire-ring' && (item.altitude ?? 0) > 0));
    assert.deepEqual(section.map((item) => item.x), [...section].sort((a, b) => a.x - b.x).map((item) => item.x));
  });
}

test('ticket08 migrates the supplied track-part art', () => {
  for (const name of ['bumper-crown.webp', 'bumper-spiked.webp', 'spring.webp', 'crate.webp', 'skull-box.webp', 'strip-wood.webp', 'strip-moss.webp']) {
    const path = asset(name);
    assert.ok(existsSync(path), `${name} exists`);
    assert.ok(statSync(path).size > 100, `${name} is not empty`);
  }
});
