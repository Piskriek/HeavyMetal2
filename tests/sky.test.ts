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
import { HORIZON_PRESETS, horizonGlowAt } from '../src/game/sky/sky-settings';
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
  assert.ok(Math.max(...all.map((c) => c.radius)) + 74000 < 200000, 'well inside the far plane');
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

test('sea: normalises colours, pattern, size and speed; presets are all valid', async () => {
  const { SEA_PRESETS, SEA_TEXTURES } = await import('../src/game/sky/sky-settings');
  const s = normalizeSkySettings({ sea: { water: '#FFFFFF', deep: 'blue', seeThrough: 3, texture: 'lava', tileSize: 5, waveSpeed: -2 } });
  assert.equal(s.sea.water, '#ffffff');
  assert.equal(s.sea.deep, DEFAULT_SKY_SETTINGS.sea.deep);
  assert.equal(s.sea.seeThrough, 0.6);
  assert.equal(s.sea.texture, DEFAULT_SKY_SETTINGS.sea.texture, 'an unknown pattern takes the default');
  assert.equal(s.sea.tileSize, 800);
  assert.equal(s.sea.waveSpeed, 0);
  for (const p of SEA_PRESETS) assert.deepEqual(normalizeSkySettings({ sea: p.sea }).sea, p.sea, `${p.id} is already normal`);
  assert.deepEqual(SEA_TEXTURES.map((t) => t.id), ['waves', 'ripples', 'shallows', 'flat']);
  assert.equal(normalizeSkySettings({}).sea.texture, 'waves', 'an old save keeps the painted waves');
});

test('sea: the pattern closes round the shore at any size (a whole number of repeats)', async () => {
  const { seaRepeatsAround } = await import('../src/game/island-route/island-sea');
  for (const size of [800, 3000, 4321, 10000]) {
    const n = seaRepeatsAround(66000, size);
    assert.ok(Number.isInteger(n) && n >= 1);
    assert.ok(Math.abs((2 * Math.PI * 66000) / n - size) / size < 0.02, 'close to the asked size');
  }
  assert.equal(seaRepeatsAround(66000, 3000), Math.round((2 * Math.PI * 66000) / 3000), 'the default is the old repeat count');
});

test('gradient opacity: defaults to fully opaque, clamps, and a preset keeps what the owner set', () => {
  assert.equal(DEFAULT_SKY_SETTINGS.gradient.opacity, 1);
  assert.equal(normalizeSkySettings({ gradient: { opacity: -1 } }).gradient.opacity, 0);
  assert.equal(normalizeSkySettings({ gradient: {} }).gradient.opacity, 1, 'an old save stays fully opaque');
  for (const p of GRADIENT_PRESETS) assert.equal(p.gradient.opacity, 1);
});

test('horizon: saves without it get the thin glow; values are clamped; presets include a crisp line', () => {
  const s = normalizeSkySettings({ mode: 'gradient' });
  assert.deepEqual(s.horizon, DEFAULT_SKY_SETTINGS.horizon);
  assert.equal(s.horizon.glow, true);
  assert.equal(s.horizon.glowColor, '#ffffff');
  assert.ok(s.horizon.glowWidth < 0.05, 'a thin band, not a wide one');
  const odd = normalizeSkySettings({ horizon: { haze: 5, fog: -1, glow: 'yes', glowColor: 'red', glowWidth: 9, glowSoftness: 2, glowStrength: -3 } });
  assert.equal(odd.horizon.haze, 1);
  assert.equal(odd.horizon.fog, 0);
  assert.equal(odd.horizon.glow, DEFAULT_SKY_SETTINGS.horizon.glow);
  assert.equal(odd.horizon.glowColor, DEFAULT_SKY_SETTINGS.horizon.glowColor);
  assert.equal(odd.horizon.glowWidth, 0.12);
  assert.equal(odd.horizon.glowSoftness, 1);
  assert.equal(odd.horizon.glowStrength, 0);
  const crisp = HORIZON_PRESETS.find((p) => p.id === 'crisp')!.horizon;
  assert.equal(crisp.haze, 0);
  assert.equal(crisp.fog, 0);
  assert.equal(crisp.glow, false);
});

test('horizon glow: strongest on the line, fading to nothing past its width; off is off', () => {
  const z = DEFAULT_SKY_SETTINGS.horizon;
  assert.ok(Math.abs(horizonGlowAt(z, 0) - z.glowStrength) < 1e-9);
  assert.ok(horizonGlowAt(z, z.glowWidth * 0.5) < horizonGlowAt(z, 0));
  assert.equal(horizonGlowAt(z, z.glowWidth * 1.01), 0);
  assert.equal(horizonGlowAt(z, -z.glowWidth * 0.3), horizonGlowAt(z, z.glowWidth * 0.3), 'fades up and down alike');
  assert.equal(horizonGlowAt({ ...z, glow: false }, 0), 0);
  const hard = { ...z, glowSoftness: 0 };
  assert.equal(horizonGlowAt(hard, z.glowWidth * 0.9), z.glowStrength, 'no fade: a hard-edged band');
});

test('clouds: horizon size shrinks the far ring (not the near one); hugging stretches the far ring out', () => {
  const base = { count: 60, size: 1, height: 1, seed: 5 };
  const plain = cloudLayout({ ...base, horizonSize: 1, horizonHug: 0 });
  const tiny = cloudLayout({ ...base, horizonSize: 0.2, horizonHug: 0 });
  const ringWidth = (all: typeof plain, r: number) => all.filter((c) => c.ring === r).reduce((a, c) => a + c.width, 0);
  assert.equal(ringWidth(tiny, 0), ringWidth(plain, 0), 'the near ring keeps its size');
  assert.ok(Math.abs(ringWidth(tiny, 2) - ringWidth(plain, 2) * 0.2) < 1e-6, 'the far ring at 0.2×');
  assert.ok(ringWidth(tiny, 1) < ringWidth(plain, 1) && ringWidth(tiny, 1) > ringWidth(plain, 1) * 0.2, 'the middle ring in between');
  const hug = cloudLayout({ ...base, horizonSize: 1, horizonHug: 1 });
  assert.ok(hug.every((c) => c.hug === 1));
  assert.ok(plain.every((c) => c.hug === 0));
  const far = hug.filter((c) => c.ring === 2);
  const near = hug.filter((c) => c.ring === 0);
  assert.ok(Math.min(...near.map((c) => c.lineOffset)) > Math.max(...far.map((c) => c.lineOffset)), 'near clouds float higher above the line than far ones');
  assert.ok(Math.max(...hug.map((c) => c.radius)) + 74000 < 200000, 'still inside the far plane');
});
