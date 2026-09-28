import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandGroups,
  alignProps,
  distributeProps,
  marqueeSelect2D,
} from '../src/game/builder/selection';

describe('IF-SELECTION: Selection, Grouping, Alignment & Distribution', () => {
  it('expands selection to all members of an active group', () => {
    const props = [
      { id: 'p1', x: 0, y: 0, z: 0, scale: 1, groupId: 'g1' },
      { id: 'p2', x: 10, y: 0, z: 0, scale: 1, groupId: 'g1' },
      { id: 'p3', x: 20, y: 0, z: 0, scale: 1, groupId: 'g2' },
      { id: 'p4', x: 30, y: 0, z: 0, scale: 1 }, // Ungrouped
    ];

    // Selecting p1 expands to p1 and p2 (same group g1)
    const expanded = expandGroups(props, ['p1']);
    assert.deepEqual(Array.from(expanded).sort(), ['p1', 'p2']);

    // Selecting p4 (ungrouped) leaves only p4
    const ungrouped = expandGroups(props, ['p4']);
    assert.deepEqual(Array.from(ungrouped), ['p4']);
  });

  it('aligns props correctly to min, center, and max', () => {
    const props = [
      { id: 'p1', x: 10, y: 0, z: 0, scale: 1 },
      { id: 'p2', x: 50, y: 0, z: 0, scale: 1 },
      { id: 'p3', x: 90, y: 0, z: 0, scale: 1 },
    ];
    const ids = new Set(['p1', 'p2', 'p3']);

    const alignedMin = alignProps(props, ids, 'x', 'min');
    assert.deepEqual(alignedMin.map((p) => p.x), [10, 10, 10]);

    const alignedCenter = alignProps(props, ids, 'x', 'center');
    assert.deepEqual(alignedCenter.map((p) => p.x), [50, 50, 50]);

    const alignedMax = alignProps(props, ids, 'x', 'max');
    assert.deepEqual(alignedMax.map((p) => p.x), [90, 90, 90]);
  });

  it('distributes props evenly along an axis', () => {
    const props = [
      { id: 'p1', x: 0, y: 0, z: 0, scale: 1 },
      { id: 'p2', x: 10, y: 0, z: 0, scale: 1 },
      { id: 'p3', x: 100, y: 0, z: 0, scale: 1 },
    ];
    const ids = new Set(['p1', 'p2', 'p3']);

    const distributed = distributeProps(props, ids, 'x');
    assert.equal(distributed[0].x, 0);
    assert.equal(distributed[1].x, 50);
    assert.equal(distributed[2].x, 100);
  });

  it('handles 2D window selection vs crossing selection', () => {
    const props = [
      { id: 'inside', x: 50, z: 50, radius: 10 },
      { id: 'touching', x: 95, z: 50, radius: 10 }, // spans 85..105, touches border 100
      { id: 'outside', x: 200, z: 200, radius: 10 },
    ];

    // Left -> Right drag: Window mode (must be fully contained)
    const windowSel = marqueeSelect2D(props, { x: 0, y: 0 }, { x: 100, y: 100 });
    assert.deepEqual(windowSel, ['inside']);

    // Right -> Left drag: Crossing mode (touching is included)
    const crossingSel = marqueeSelect2D(props, { x: 100, y: 0 }, { x: 0, y: 100 });
    assert.deepEqual(crossingSel.sort(), ['inside', 'touching']);
  });
});
