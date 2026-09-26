/** Painted builder shelf icons and loadout arc gauge. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRIMITIVE_DEFINITIONS } from '../src/game/builder/primitives';
import { LIGHT_DEFINITIONS } from '../src/game/builder/light-rig';
import BlizzardGauge, { arcGaugeNeedleAngle } from '../src/components/ui/BlizzardGauge';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicFile = (url: string) => `${root}public${url}`;

test('every primitive and light preset uses an existing painted PNG icon', () => {
  const definitions = [...PRIMITIVE_DEFINITIONS, ...LIGHT_DEFINITIONS];
  assert.equal(PRIMITIVE_DEFINITIONS.length, 10);
  assert.equal(LIGHT_DEFINITIONS.length, 6);
  for (const definition of definitions) {
    assert.match(definition.url, /^\/art\/ui\/icons\/builder-(?:prim|light)-[a-z]+\.png$/, definition.type);
    assert.ok(existsSync(publicFile(definition.url)), `${definition.type}: ${definition.url} exists`);
  }
  assert.ok(existsSync(publicFile('/art/ui/icons/custom-model.png')));
});

test('builder icon definitions contain no SVG data URI', () => {
  for (const source of ['src/game/builder/primitives.ts', 'src/game/builder/light-rig.ts']) {
    assert.doesNotMatch(readFileSync(`${root}${source}`, 'utf8'), /data:image\/svg/i, source);
  }
});

test('painted arc gauge keeps the original clamped 270 degree needle sweep', () => {
  assert.equal(arcGaugeNeedleAngle(0, 10), 135);
  assert.equal(arcGaugeNeedleAngle(5, 10), 270);
  assert.equal(arcGaugeNeedleAngle(10, 10), 405);
  assert.equal(arcGaugeNeedleAngle(-1, 10), 135);
  assert.equal(arcGaugeNeedleAngle(12, 10), 405);
});

test('arc gauge renders the painted face and hub-pivoted needle, not SVG ticks', () => {
  const html = renderToStaticMarkup(createElement(BlizzardGauge, { variant: 'arc', value: 5, max: 10, label: 'Grip' }));
  assert.match(html, /ui-gauge-arc-face\.png/);
  assert.match(html, /ui-gauge-needle\.png/);
  assert.match(html, /rotate\(270deg\)/);
  assert.doesNotMatch(html, /<svg|gauge-tick|gauge-value-arc/);
});
