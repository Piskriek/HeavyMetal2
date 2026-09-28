/**
 * A dressed island (a thousand props) stays smooth: flat cards draw in one pass, the per-frame prop
 * checks look definitions up instead of scanning the catalogue, and the loading bar's warm-up uploads
 * every model before the first frame.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const builder = readFileSync(new URL('../src/game/track-builder-3d.ts', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');

test('flat 2D props (decals and fixed cards) draw in one pass: no per-frame shader rebuild', () => {
  const create = builder.slice(builder.indexOf('private createPropSprite('), builder.indexOf('private applySpriteLook('));
  const doubleSided = create.match(/side: THREE\.DoubleSide,/g) ?? [];
  const singlePass = create.match(/forceSinglePass: true,/g) ?? [];
  assert.ok(doubleSided.length >= 4);
  assert.equal(singlePass.length, doubleSided.length, 'every two-sided card material is single-pass');
});

test('the race loop\'s per-prop checks use the definition index, not a catalogue scan', () => {
  assert.match(builder, /function propDefinition\(type: string\): PropDefinition \| undefined/);
  const sling = builder.slice(builder.indexOf('private isSlingshotProp('), builder.indexOf('setSlingshotsVisible('));
  const ramps = builder.slice(builder.indexOf('getPlacedRamps(): readonly PlacedProp[]'), builder.indexOf('private updateSelectionBox('));
  for (const body of [sling, ramps]) {
    assert.match(body, /propDefinition\(/);
    assert.doesNotMatch(body, /PROP_DEFINITIONS\.find/);
  }
});

test('the warm-up draws one frame with nothing culled, so every model is uploaded behind the loading bar', () => {
  const warm = renderer.slice(renderer.indexOf('async warmUp('), renderer.indexOf('setSkybox(skyId: string)'));
  assert.match(warm, /o\.frustumCulled = false/);
  assert.match(warm, /finally \{ for \(const o of culled\) o\.frustumCulled = true; \}/, 'culling is restored');
});
