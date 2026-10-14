import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPlotLandmarkZone,
  sampleStartingPlotHeight,
} from '../src/curated-starting-plot';

test('keeps Gate Pad Plateau flat and carves -3.5m East Hydro Basin', () => {
  assert.ok(Math.abs(sampleStartingPlotHeight(0, 0)) < 0.25);
  assert.ok(sampleStartingPlotHeight(62, 0) < -2.5);
  assert.equal(classifyPlotLandmarkZone(62, 0), 'low-hydro-basin');
});
