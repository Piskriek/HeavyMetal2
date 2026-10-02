import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HUD_PRESETS,
  presetById,
  elementRect,
  cssFor,
  validateLayout,
  normalizeLayout,
  moveElement,
  setScale,
  toggle,
  snapOffsets,
  duplicateLayout,
  layoutToJson,
  layoutFromJson,
  SIZES
} from '../src/index';

import type { HudElement, HudLayout } from '../src/types';

test('all presets validate without errors', () => {
  assert.equal(HUD_PRESETS.length, 4);
  for (const preset of HUD_PRESETS) {
    const res = validateLayout(preset);
    assert.equal(res.ok, true, `Preset ${preset.id} failed validation: ${res.errors.join(', ')}`);
    assert.equal(res.errors.length, 0);
  }

  assert.ok(presetById('classic'));
  assert.ok(presetById('minimal'));
  assert.ok(presetById('kids'));
  assert.ok(presetById('sim'));
  assert.equal(presetById('unknown'), undefined);
});

test('elementRect known numbers for left, right, centre, top, bottom and middle on 800x450', () => {
  const viewport = { width: 800, height: 450 };

  // Speed: w=120, h=56
  // 1. top-left anchor: scale=1, offsetX=15, offsetY=25
  const leftTopEl: HudElement = {
    id: 's1',
    kind: 'speed',
    anchor: 'top-left',
    offsetX: 15,
    offsetY: 25,
    scale: 1,
    visible: true,
    opacity: 1
  };
  const r1 = elementRect(leftTopEl, viewport);
  assert.deepEqual(r1, { x: 15, y: 25, w: 120, h: 56 });

  // 2. bottom-right anchor: scale=1, offsetX=30, offsetY=40
  // x = 800 - 120 - 30 = 650
  // y = 450 - 56 - 40 = 354
  const rightBottomEl: HudElement = {
    id: 's2',
    kind: 'speed',
    anchor: 'bottom-right',
    offsetX: 30,
    offsetY: 40,
    scale: 1,
    visible: true,
    opacity: 1
  };
  const r2 = elementRect(rightBottomEl, viewport);
  assert.deepEqual(r2, { x: 650, y: 354, w: 120, h: 56 });

  // 3. center anchor: scale=2, offsetX=10, offsetY=-5
  // w = 120 * 2 = 240, h = 56 * 2 = 112
  // x = (800 - 240) / 2 + 10 = 280 + 10 = 290
  // y = (450 - 112) / 2 + (-5) = 169 - 5 = 164
  const centerEl: HudElement = {
    id: 's3',
    kind: 'speed',
    anchor: 'center',
    offsetX: 10,
    offsetY: -5,
    scale: 2,
    visible: true,
    opacity: 1
  };
  const r3 = elementRect(centerEl, viewport);
  assert.deepEqual(r3, { x: 290, y: 164, w: 240, h: 112 });

  // 4. middle-left: x=offsetX, y=(viewport.height - h)/2 + offsetY
  const midLeftEl: HudElement = {
    id: 's4',
    kind: 'lap', // 70x40
    anchor: 'middle-left',
    offsetX: 5,
    offsetY: 10,
    scale: 1,
    visible: true,
    opacity: 1
  };
  const r4 = elementRect(midLeftEl, viewport);
  assert.deepEqual(r4, { x: 5, y: (450 - 40) / 2 + 10, w: 70, h: 40 });

  // 5. top-center: x=(viewport.width - w)/2 + offsetX, y=offsetY
  const topCenterEl: HudElement = {
    id: 's5',
    kind: 'time', // 100x40
    anchor: 'top-center',
    offsetX: 0,
    offsetY: 12,
    scale: 1,
    visible: true,
    opacity: 1
  };
  const r5 = elementRect(topCenterEl, viewport);
  assert.deepEqual(r5, { x: (800 - 100) / 2, y: 12, w: 100, h: 40 });

  // 6. bottom-center: x=(viewport.width - w)/2 + offsetX, y=height - h - offsetY
  const bottomCenterEl: HudElement = {
    id: 's6',
    kind: 'message', // 260x48
    anchor: 'bottom-center',
    offsetX: 20,
    offsetY: 30,
    scale: 1,
    visible: true,
    opacity: 1
  };
  const r6 = elementRect(bottomCenterEl, viewport);
  assert.deepEqual(r6, { x: (800 - 260) / 2 + 20, y: 450 - 48 - 30, w: 260, h: 48 });
});

test('cssFor of hidden element has display none and centred element has translate', () => {
  const hiddenEl: HudElement = {
    id: 'h1',
    kind: 'minimap',
    anchor: 'top-left',
    offsetX: 10,
    offsetY: 20,
    scale: 1,
    visible: false,
    opacity: 0.8
  };
  const hiddenCss = cssFor(hiddenEl);
  assert.equal(hiddenCss['display'], 'none');
  assert.equal(hiddenCss['position'], 'absolute');
  assert.equal(hiddenCss['left'], '10px');
  assert.equal(hiddenCss['top'], '20px');
  assert.equal(hiddenCss['opacity'], '0.8');

  const visibleCenterEl: HudElement = {
    id: 'c1',
    kind: 'speed',
    anchor: 'center',
    offsetX: 5,
    offsetY: -10,
    scale: 1.5,
    visible: true,
    opacity: 1
  };
  const centerCss = cssFor(visibleCenterEl);
  assert.equal(centerCss['display'], undefined);
  assert.equal(centerCss['position'], 'absolute');
  assert.equal(centerCss['left'], '50%');
  assert.equal(centerCss['top'], '50%');
  assert.ok(centerCss['transform']?.includes('translate(calc(-50% + 5px), calc(-50% + -10px))'));
  assert.ok(centerCss['transform']?.includes('scale(1.5)'));

  // Deterministic key order check
  const keys = Object.keys(hiddenCss);
  assert.deepEqual(keys, ['display', 'position', 'left', 'top', 'transformOrigin', 'transform', 'opacity']);
});

test('validate gives readable errors and never throws on null, 5, [], "x", {}', () => {
  const inputs = [null, 5, [], 'x', {}, undefined, true];
  for (const input of inputs) {
    assert.doesNotThrow(() => {
      const res = validateLayout(input);
      assert.equal(res.ok, false);
      assert.ok(res.errors.length > 0);
    });
  }

  // Readable sentence test
  const invalidLayout = {
    id: 'test',
    name: 'Test',
    elements: [
      {
        id: 'speed',
        kind: 'speed',
        anchor: 'top-left',
        offsetX: 0,
        offsetY: 0,
        scale: 5, // invalid
        visible: true,
        opacity: 1
      },
      {
        id: 'speed', // duplicate id
        kind: 'invalid-kind', // invalid kind
        anchor: 'invalid-anchor', // invalid anchor
        offsetX: 'not a number', // invalid offsetX
        offsetY: 0,
        scale: 1,
        visible: 'true', // not boolean
        opacity: 2 // invalid opacity
      }
    ]
  };

  const res = validateLayout(invalidLayout);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("element 'speed': scale must be between 0.5 and 2")));
  assert.ok(res.errors.some((e) => e.includes("element 'speed': duplicate id 'speed'")));
  assert.ok(res.errors.some((e) => e.includes("element 'speed': invalid kind 'invalid-kind'")));
  assert.ok(res.errors.some((e) => e.includes("element 'speed': invalid anchor 'invalid-anchor'")));
  assert.ok(res.errors.some((e) => e.includes("element 'speed': offsetX must be a number")));
  assert.ok(res.errors.some((e) => e.includes("element 'speed': visible must be a boolean")));
  assert.ok(res.errors.some((e) => e.includes("element 'speed': opacity must be between 0 and 1")));
});

test('normalize clamps and drops junk', () => {
  const dirtyLayout: HudLayout = {
    id: 'custom',
    name: 'Custom',
    elements: [
      {
        id: 'e1',
        kind: 'speed',
        anchor: 'invalid-anchor' as any,
        offsetX: 1000,
        offsetY: -999,
        scale: 99,
        visible: true,
        opacity: 5
      },
      {
        id: 'e2',
        kind: 'unknown-junk' as any,
        anchor: 'top-right',
        offsetX: 10,
        offsetY: 10,
        scale: 1,
        visible: true,
        opacity: 1
      },
      {
        id: 'e3',
        kind: 'lap',
        anchor: 'bottom-center',
        offsetX: -100,
        offsetY: 200,
        scale: 0.1,
        visible: false,
        opacity: -0.5
      }
    ]
  };

  const clean = normalizeLayout(dirtyLayout);
  assert.equal(clean.elements.length, 2); // e2 dropped
  assert.equal(clean.elements[0]?.id, 'e1');
  assert.equal(clean.elements[0]?.anchor, 'top-left'); // default anchor
  assert.equal(clean.elements[0]?.offsetX, 600); // clamped to 600
  assert.equal(clean.elements[0]?.offsetY, -600); // clamped to -600
  assert.equal(clean.elements[0]?.scale, 2); // clamped to 2
  assert.equal(clean.elements[0]?.opacity, 1); // clamped to 1

  assert.equal(clean.elements[1]?.id, 'e3');
  assert.equal(clean.elements[1]?.scale, 0.5); // clamped to 0.5
  assert.equal(clean.elements[1]?.opacity, 0); // clamped to 0
});

test('json round trip', () => {
  const classic = HUD_PRESETS[0]!;
  const json = layoutToJson(classic);
  const parsed = layoutFromJson(json);

  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.layout, classic);

  const brokenJson = layoutFromJson('{ invalid json');
  assert.equal(brokenJson.layout, null);
  assert.ok(brokenJson.errors[0]?.includes('JSON parse error'));

  const semanticInvalidJson = layoutFromJson(JSON.stringify({ id: '', name: 'x', elements: [] }));
  assert.equal(semanticInvalidJson.layout, null);
  assert.ok(semanticInvalidJson.errors.length > 0);
});

test('edit helpers do not mutate their input', () => {
  const classic = HUD_PRESETS[0]!;
  const originalJson = JSON.stringify(classic);

  const moved = moveElement(classic, 'speed', 'bottom-right', 55, 65);
  assert.notEqual(moved, classic);
  assert.notEqual(moved.elements, classic.elements);
  assert.equal(moved.elements.find((e) => e.id === 'speed')?.anchor, 'bottom-right');
  assert.equal(moved.elements.find((e) => e.id === 'speed')?.offsetX, 55);
  assert.equal(moved.elements.find((e) => e.id === 'speed')?.offsetY, 65);
  assert.equal(JSON.stringify(classic), originalJson);

  const scaled = setScale(classic, 'speed', 1.8);
  assert.notEqual(scaled, classic);
  assert.equal(scaled.elements.find((e) => e.id === 'speed')?.scale, 1.8);
  assert.equal(JSON.stringify(classic), originalJson);

  const toggled = toggle(classic, 'speed');
  assert.notEqual(toggled, classic);
  assert.equal(toggled.elements.find((e) => e.id === 'speed')?.visible, false);
  assert.equal(JSON.stringify(classic), originalJson);

  const snapped = snapOffsets(moved, 10);
  assert.notEqual(snapped, moved);
  assert.equal(snapped.elements.find((e) => e.id === 'speed')?.offsetX, 60);
  assert.equal(snapped.elements.find((e) => e.id === 'speed')?.offsetY, 70);

  const duplicated = duplicateLayout(classic, 'classic-copy', 'Classic Copy');
  assert.equal(duplicated.id, 'classic-copy');
  assert.equal(duplicated.name, 'Classic Copy');
  assert.notEqual(duplicated.elements, classic.elements);
  assert.deepEqual(duplicated.elements, classic.elements);
  assert.equal(JSON.stringify(classic), originalJson);
});

test('SIZES constant contains all 8 HudKinds with correct dimensions', () => {
  assert.deepEqual(SIZES.speed, { w: 120, h: 56 });
  assert.deepEqual(SIZES.lap, { w: 70, h: 40 });
  assert.deepEqual(SIZES.position, { w: 90, h: 44 });
  assert.deepEqual(SIZES.time, { w: 100, h: 40 });
  assert.deepEqual(SIZES.item, { w: 56, h: 56 });
  assert.deepEqual(SIZES.minimap, { w: 150, h: 150 });
  assert.deepEqual(SIZES.message, { w: 260, h: 48 });
  assert.deepEqual(SIZES.boost, { w: 160, h: 14 });
});
