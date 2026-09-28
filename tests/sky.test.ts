/**
 * SKY: the Sky & Clouds window's settings (normalising, the store), the gradient's colour law (the sky
 * shader's twin), and the cloud layout round the island.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CLOUD_COUNT_MAX, DEFAULT_SKY_SETTINGS, GRADIENT_PRESETS, SKY_SETTINGS_KEY, _resetSkySettingsCache, getSkySettings,
  gradientBlendWidth, gradientColorAt, normalizeSkySettings, onSkySettings, resetSkySettings, setSkySettings,
} from '../src/game/sky/sky-settings';
import { CLOUD_RINGS, CLOUD_SHAPES, CloudLayer, cloudArtUrl, cloudLayout } from '../src/game/sky/sky-clouds';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

test('settings: anything normalises to valid settings, defaults filling the gaps', () => {
  assert.deepEqual(normalizeSkySettings(null), DEFAULT_SKY_SETTINGS);
  assert.deepEqual(normalizeSkySettings('junk'), DEFAULT_SKY_SETTINGS);
  const s = normalizeSkySettings({ mode: 'gradient', gradient: { top: '#ABCDEF', middle: 'red', crispness: 7 }, clouds: { count: 500, size: -1, enabled: false, tint: '#123' } });
  assert.equal(s.mode, 'gradient');
  assert.equal(s.gradient.top, '#abcdef', 'hex kept, lower-cased');
  assert.equal(s.gradient.middle, DEFAULT_SKY_SETTINGS.gradient.middle, 'a bad colour takes the default');
  assert.equal(s.gradient.crispness, 1, 'clamped');
  assert.equal(s.clouds.count, CLOUD_COUNT_MAX);
  assert.equal(s.clouds.size, 0.3);
  assert.equal(s.clouds.enabled, false);
  assert.equal(s.clouds.tint, '#ffffff', 'short hex is not accepted');
  assert.equal(normalizeSkySettings({ mode: 'nonsense' }).mode, 'painted');
});

test('gradient: horizon at the horizon, top overhead, the middle colour at its height', () => {
  for (const { gradient: g } of GRADIENT_PRESETS) {
    const [hr, hg, hb] = hexRgb(g.horizon), [tr, tg, tb] = hexRgb(g.top), [mr, mg, mb] = hexRgb(g.middle);
    const at0 = gradientColorAt(g, 0), at1 = gradientColorAt(g, 1), atMid = gradientColorAt(g, g.midHeight);
    assert.ok(near(at0[0], hr!) && near(at0[1], hg!) && near(at0[2], hb!), 'h = 0 is the horizon colour');
    assert.ok(near(at1[0], tr!) && near(at1[1], tg!) && near(at1[2], tb!), 'h = 1 is the top colour');
    assert.ok(near(atMid[0], mr!) && near(atMid[1], mg!) && near(atMid[2], mb!), 'the middle height is the middle colour');
    assert.deepEqual(gradientColorAt(g, -0.5), at0, 'below the horizon stays the horizon (the sea covers it)');
  }
});

test('gradient: crisper means a narrower blend between the bands', () => {
  assert.ok(gradientBlendWidth(1) < gradientBlendWidth(0.5) && gradientBlendWidth(0.5) < gradientBlendWidth(0));
  const soft = { ...GRADIENT_PRESETS[0]!.gradient, crispness: 0 }, crisp = { ...soft, crispness: 1 };
  // A quarter of the way to the middle band: a crisp sky is still pure horizon there, a soft one has moved.
  const h = soft.midHeight * 0.25;
  const [hr] = hexRgb(soft.horizon);
  assert.ok(near(gradientColorAt(crisp, h)[0], hr!), 'crisp: still the horizon colour');
  assert.ok(!near(gradientColorAt(soft, h)[0], hr!, 1e-3), 'soft: already blending');
});

test('store: changes merge field by field, save, and reach every listener', () => {
  const saved = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => { saved.set(k, v); },
  };
  try {
    _resetSkySettingsCache();
    assert.deepEqual(getSkySettings(), DEFAULT_SKY_SETTINGS);
    const seen: string[] = [];
    const off = onSkySettings((s) => seen.push(s.mode));
    setSkySettings({ mode: 'gradient', gradient: { top: '#000000' } });
    setSkySettings({ clouds: { count: 12 } });
    const s = getSkySettings();
    assert.equal(s.mode, 'gradient');
    assert.equal(s.gradient.top, '#000000');
    assert.equal(s.gradient.horizon, DEFAULT_SKY_SETTINGS.gradient.horizon, 'untouched fields kept');
    assert.equal(s.clouds.count, 12);
    assert.deepEqual(seen, ['gradient', 'gradient']);
    _resetSkySettingsCache();
    assert.deepEqual(getSkySettings(), s, 'read back from storage');
    assert.ok(saved.has(SKY_SETTINGS_KEY));
    off();
    resetSkySettings();
    assert.equal(seen.length, 2, 'unsubscribed');
    assert.deepEqual(getSkySettings(), DEFAULT_SKY_SETTINGS);
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    _resetSkySettingsCache();
  }
});

test('clouds: ten shapes, each with its art file', () => {
  assert.equal(CLOUD_SHAPES.length, 10);
  assert.equal(new Set(CLOUD_SHAPES.map((s) => s.id)).size, 10);
  for (const s of CLOUD_SHAPES) {
    assert.match(cloudArtUrl(s), /^\/art\/clouds\/cloud-\d\d\.png$/);
    for (const [x, y, r] of s.lobes) assert.ok(x - r >= -0.05 && x + r <= 1.05 && y >= 0 && y <= 1 && r > 0, `${s.id}: lobes inside the canvas`);
  }
});

test('clouds: the layout rings the island, each ring further out, lower and smaller toward the horizon', () => {
  const settings = { count: 60, size: 1, height: 1, seed: 7 };
  const all = cloudLayout(settings);
  assert.equal(all.length, 60);
  const byRing = CLOUD_RINGS.map((_, i) => all.filter((c) => c.ring === i));
  byRing.forEach((ring, i) => {
    assert.ok(ring.length > 0, `ring ${i} has clouds`);
    for (const c of ring) {
      assert.ok(c.radius >= CLOUD_RINGS[i]!.r[0] && c.radius <= CLOUD_RINGS[i]!.r[1]);
      assert.ok(c.shape >= 0 && c.shape < CLOUD_SHAPES.length);
    }
  });
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (let i = 1; i < byRing.length; i++) {
    assert.ok(mean(byRing[i]!.map((c) => c.radius)) > mean(byRing[i - 1]!.map((c) => c.radius)), 'further out');
    assert.ok(mean(byRing[i]!.map((c) => c.y)) < mean(byRing[i - 1]!.map((c) => c.y)), 'lower');
    assert.ok(mean(byRing[i]!.map((c) => c.width)) < mean(byRing[i - 1]!.map((c) => c.width)), 'smaller');
  }
  // Spread all the way round, not bunched on one side.
  const quadrants = new Set(all.map((c) => Math.floor((((c.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2))));
  assert.equal(quadrants.size, 4);
  // The far ring stays inside the camera's far plane from anywhere on the island.
  assert.ok(Math.max(...all.map((c) => c.radius)) + 74000 < 200000);
});

test('clouds: seeded (same settings, same sky), and size and height scale every cloud', () => {
  const a = cloudLayout({ count: 30, size: 1, height: 1, seed: 3 });
  assert.deepEqual(cloudLayout({ count: 30, size: 1, height: 1, seed: 3 }), a);
  assert.notDeepEqual(cloudLayout({ count: 30, size: 1, height: 1, seed: 4 }), a);
  const big = cloudLayout({ count: 30, size: 2, height: 0.5, seed: 3 });
  big.forEach((c, i) => { assert.ok(near(c.width, a[i]!.width * 2)); assert.ok(near(c.y, a[i]!.y * 0.5)); });
  assert.equal(cloudLayout({ count: 0, size: 1, height: 1, seed: 1 }).length, 0);
});

test('clouds: the layer builds its sprites, takes no raycasts, drifts only when asked', () => {
  const layer = new CloudLayer({ loadArt: false });
  layer.apply({ ...DEFAULT_SKY_SETTINGS.clouds, count: 20 });
  assert.equal(layer.count, 20);
  assert.equal(layer.group.children.length, 20);
  const sprite = layer.group.children[0] as THREE.Sprite;
  const hits: THREE.Intersection[] = [];
  const raycaster = new THREE.Raycaster(new THREE.Vector3(sprite.position.x, sprite.position.y, sprite.position.z + 10), new THREE.Vector3(0, 0, -1));
  raycaster.camera = new THREE.PerspectiveCamera();
  sprite.raycast(raycaster, hits);
  assert.equal(hits.length, 0, 'brushes and placement clicks go straight through');
  layer.update(0, 0);
  const before = sprite.position.clone();
  layer.update(120, 0);
  assert.ok(sprite.position.distanceTo(before) < 1e-6, 'drift 0: still');
  layer.update(120, 1);
  assert.ok(sprite.position.distanceTo(before) > 1, 'drift 1: moved');
  layer.apply({ ...DEFAULT_SKY_SETTINGS.clouds, count: 20, enabled: false });
  assert.equal(layer.group.visible, false);
  layer.apply({ ...DEFAULT_SKY_SETTINGS.clouds, count: 5 });
  assert.equal(layer.group.children.length, 5, 'a new amount rebuilds the layout');
  layer.dispose();
});
