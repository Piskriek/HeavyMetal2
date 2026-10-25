import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveItemTitle, resolveItemDescription, generateProceduralSvgSwatch } from '../src/thumbnails';

test('resolveItemTitle translates camelCase IDs and internal keys to plain English', () => {
  assert.equal(resolveItemTitle('pixelRaw'), 'Raw Pixels');
  assert.equal(resolveItemTitle('pxd-mono'), 'Raw Pixels (Mono)');
  assert.equal(resolveItemTitle('rockDrill'), 'Rock Drill');
  assert.equal(resolveItemTitle('shapePress'), 'Shape Press');
  assert.equal(resolveItemTitle('lightTower'), 'Light Projector');
  assert.equal(resolveItemTitle('waterGen'), 'Water Maker');
  assert.equal(resolveItemTitle('powerCell'), 'Power Unit');
  assert.equal(resolveItemTitle('weaponBench'), 'Weapon Modding Bench');
  assert.equal(resolveItemTitle('blankCart'), 'Blank Cartridge');
});

test('resolveItemDescription returns title and 2-line origin/purpose tooltip', () => {
  const pxd = resolveItemDescription('pxd-mono');
  assert.equal(pxd.title, 'Raw Pixels (Mono)');
  assert.match(pxd.hint, /Beam Rifle/);
  assert.match(pxd.hint, /Texture Mill/);

  const vtx = resolveItemDescription('vtx-fine');
  assert.equal(vtx.title, 'Raw Vertices (Fine)');
  assert.match(vtx.hint, /Shape Press/);

  const ore = resolveItemDescription('ore');
  assert.equal(ore.title, 'Regolith Ore');
  assert.match(ore.hint, /rock drills/);
});

test('generateProceduralSvgSwatch produces valid SVG data URL with directional relief lighting', () => {
  const url = generateProceduralSvgSwatch({
    baseColor: '#8c7a64',
    pattern: 'grain',
    size: 64,
  });
  assert.ok(url.startsWith('data:image/svg+xml'));
  assert.ok(url.includes('linearGradient'));
});
