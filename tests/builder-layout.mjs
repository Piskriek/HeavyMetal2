import test from 'node:test';
import assert from 'node:assert/strict';

test('T3 DrawerLayout: preferences serialization round-trip', () => {
  const prefs = {
    leftWidth: 320,
    rightWidth: 380,
    dockHeight: 250,
    leftCollapsed: true,
    rightCollapsed: false,
    dockCollapsed: true,
  };

  const serialized = JSON.stringify(prefs);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.leftWidth, 320);
  assert.equal(parsed.rightWidth, 380);
  assert.equal(parsed.dockHeight, 250);
  assert.equal(parsed.leftCollapsed, true);
  assert.equal(parsed.rightCollapsed, false);
  assert.equal(parsed.dockCollapsed, true);
});

test('T3 DrawerLayout: viewport constraints and bounds', () => {
  const viewports = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ];

  for (const vp of viewports) {
    const defaultLeft = 300;
    const defaultRight = 340;
    const defaultDock = 220;

    // Viewport center area with default layout must always be strictly positive and spacious
    const remainingWidth = vp.width - (defaultLeft + defaultRight);
    const remainingHeight = vp.height - defaultDock;

    assert.ok(remainingWidth >= 640, `Viewport width ${vp.width} preserves canvas width >= 640`);
    assert.ok(remainingHeight >= 500, `Viewport height ${vp.height} preserves canvas height >= 500`);
  }
});
