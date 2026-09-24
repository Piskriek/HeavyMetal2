/**
 * Animated decorations (4-frame 2x2 sheets).
 *
 * Validates:
 * - Frame math: grid defaults, frame timing/looping, row-major UVs, id phases
 * - Registry: one entry per sheet on disk, unique types, 2x2 grids, positive fps
 * - Sheets on disk: keyed alpha files exist with even (cuttable) dimensions
 * - Headless builder: offsets advance per frame, animate=false and reduced
 *   motion freeze on frame 0, batch toggle flips the flag
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  TrackBuilder3D,
  PROP_DEFINITIONS,
  ANIMATED_SOURCE_ART,
  ANIM_SPEED_MAX,
  ANIM_SPEED_MIN,
  ANIM_SPEED_STEP,
  animGridFor,
  animFrameAt,
  animFrameUV,
  animPhaseFor,
  animEnabledFrames,
  animSpeedFor,
  animatedTwinDef,
  normalizeAnimFrames,
  normalizeAnimFrameDelays,
  propHasAnimatedOption,
  type PlacedProp,
  type PropDefinition,
} from '../src/game/track-builder-3d';
import type { TrackData } from '../src/game/renderer-3d';

const here = dirname(fileURLToPath(import.meta.url));
const alphaDir = join(here, '../public/art/animated/alpha');

function pngDims(path: string): { w: number; h: number } {
  const buf = readFileSync(path);
  assert.equal(buf.readUInt32BE(0), 0x89504e47, `${path} is not a PNG`);
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR', `${path} has no IHDR`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function createMockStorage(): Storage {
  const data = new Map<string, string>();
  return {
    _data: data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, val: string) => data.set(key, String(val)),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
  } as unknown as Storage;
}

const mockTrack = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;

function makeBuilder() {
  (globalThis as any).localStorage = createMockStorage();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const builder = new TrackBuilder3D(scene, camera, mockTrack);
  builder.clearAll();
  return { scene, builder };
}

function makeProp(overrides: Partial<PlacedProp> = {}): PlacedProp {
  return {
    id: `prop_${Math.random().toString(36).slice(2, 10)}`,
    type: 'anim_01_torchbearer_flame',
    name: 'Torchbearer (Animated)',
    x: 100, y: 200, z: 300,
    rotY: 0, scale: 1,
    alignToTrack: false,
    ...overrides,
  };
}

function spriteMap(scene: THREE.Scene, propId: string): THREE.Texture {
  const obj = scene.getObjectByName(`PlacedProp_${propId}`) as THREE.Sprite | undefined;
  assert.ok(obj, `sprite for ${propId} exists in scene`);
  const map = (obj.material as THREE.SpriteMaterial).map;
  assert.ok(map, `sprite for ${propId} has a texture`);
  return map;
}

test('Animated: frame math', async (t) => {
  await t.test('grid defaults to 2x2 @ 6fps and honours overrides', () => {
    assert.deepEqual(animGridFor({} as PropDefinition), { cols: 2, rows: 2, fps: 6 });
    assert.deepEqual(
      animGridFor({ animCols: 4, animRows: 1, animFps: 12 } as PropDefinition),
      { cols: 4, rows: 1, fps: 12 },
    );
    assert.deepEqual(
      animGridFor({ animCols: 0, animRows: -2, animFps: 0 } as PropDefinition),
      { cols: 2, rows: 2, fps: 6 },
    );
  });

  await t.test('frames advance with time and loop', () => {
    assert.equal(animFrameAt(0, 7, 4), 0);
    assert.equal(animFrameAt(0.5 / 7, 7, 4), 0);
    assert.equal(animFrameAt(1 / 7 + 0.001, 7, 4), 1);
    assert.equal(animFrameAt(3 / 7 + 0.001, 7, 4), 3);
    assert.equal(animFrameAt(4 / 7 + 0.001, 7, 4), 0);
    assert.equal(animFrameAt(1 / 7 + 0.001, 7, 4, 2), 3);
    assert.equal(animFrameAt(2 / 7 + 0.001, 7, 4, 2), 0);
    assert.equal(animFrameAt(5, 0, 4), 0);
    assert.equal(animFrameAt(5, 7, 1), 0);
  });

  await t.test('UVs are row-major with frame 0 top-left', () => {
    assert.deepEqual(animFrameUV(0, 2, 2), { u: 0, v: 0.5 });
    assert.deepEqual(animFrameUV(1, 2, 2), { u: 0.5, v: 0.5 });
    assert.deepEqual(animFrameUV(2, 2, 2), { u: 0, v: 0 });
    assert.deepEqual(animFrameUV(3, 2, 2), { u: 0.5, v: 0 });
    assert.deepEqual(animFrameUV(4, 2, 2), { u: 0, v: 0.5 });
    assert.deepEqual(animFrameUV(5, 4, 1), { u: 0.25, v: 0 });
  });

  await t.test('phases are deterministic and in range', () => {
    const a = animPhaseFor('prop_abc123', 4);
    assert.equal(animPhaseFor('prop_abc123', 4), a);
    assert.ok(a >= 0 && a < 4);
    assert.equal(animPhaseFor('anything', 1), 0);
  });
});

test('Animated: registry entries', async (t) => {
  const animated = PROP_DEFINITIONS.filter((d) => d.category === 'animated');

  await t.test('every keyed sheet on disk is registered exactly once', () => {
    // Derived rather than hardcoded: the count grows with each batch, and a
    // stale literal here would fail a green build for no real reason.
    const onDisk = readdirSync(alphaDir).filter((f) => f.endsWith('.png'));
    assert.equal(animated.length, onDisk.length,
      `registered ${animated.length} but ${onDisk.length} sheets exist`);
    for (const file of onDisk) {
      assert.ok(animated.some((d) => d.url.endsWith(`/${file}`)), `registered: ${file}`);
    }
  });

  await t.test('entries are unique 2x2 sheets with positive fps', () => {
    const types = new Set(animated.map((d) => d.type));
    assert.equal(types.size, animated.length);
    for (const def of animated) {
      assert.equal(def.isAnimated, true);
      assert.deepEqual(animGridFor(def), { cols: 2, rows: 2, fps: def.animFps as number });
      assert.ok((def.animFps as number) > 0);
      assert.ok(def.url.startsWith('/art/animated/alpha/anim-'));
      assert.ok(def.defaultWidth > 0 && def.defaultHeight > 0);
    }
  });

  await t.test('keyed sheets exist with even (cuttable) dimensions', () => {
    for (const def of animated) {
      const file = join(alphaDir, def.url.split('/').pop() as string);
      assert.ok(existsSync(file), `sheet exists: ${file}`);
      const { w, h } = pngDims(file);
      assert.equal(w % 2, 0, `${file} width ${w} is even`);
      assert.equal(h % 2, 0, `${file} height ${h} is even`);
    }
  });
});

test('Animated: headless builder playback', async (t) => {
  await t.test('placed sheet shows one quadrant and advances frames', () => {
    const { scene, builder } = makeBuilder();
    const prop = makeProp({ id: 'anim_play_1', animate: true });
    builder.importJson(JSON.stringify([prop]));

    const map = spriteMap(scene, prop.id);
    assert.deepEqual([map.repeat.x, map.repeat.y], [0.5, 0.5]);

    const def = PROP_DEFINITIONS.find((d) => d.type === prop.type) as PropDefinition;
    const { cols, rows, fps } = animGridFor(def);
    const phase = animPhaseFor(prop.id, cols * rows);

    builder.updateAnimations(0);
    let uv = animFrameUV(animFrameAt(0, fps, cols * rows, phase), cols, rows);
    assert.deepEqual([map.offset.x, map.offset.y], [uv.u, uv.v]);

    const t1 = 1 / fps + 0.001;
    builder.updateAnimations(t1);
    uv = animFrameUV(animFrameAt(t1, fps, cols * rows, phase), cols, rows);
    assert.deepEqual([map.offset.x, map.offset.y], [uv.u, uv.v]);

    assert.equal(builder.hasPlayingAnimations(), true);
    builder.destroy();
  });

  await t.test('animate=false freezes on frame 0 and gates preview renders', () => {
    const { scene, builder } = makeBuilder();
    const prop = makeProp({ id: 'anim_pause_1', animate: false });
    builder.importJson(JSON.stringify([prop]));

    builder.updateAnimations(10.25);
    const map = spriteMap(scene, prop.id);
    const uv0 = animFrameUV(0, 2, 2);
    assert.deepEqual([map.offset.x, map.offset.y], [uv0.u, uv0.v]);
    assert.equal(builder.hasPlayingAnimations(), false);
    builder.destroy();
  });

  await t.test('reduced motion freezes on frame 0', () => {
    const { scene, builder } = makeBuilder();
    builder.importJson(JSON.stringify([makeProp({ id: 'anim_rm_1', animate: true })]));
    builder.updateAnimations(10.25, true);
    const map = spriteMap(scene, 'anim_rm_1');
    const uv0 = animFrameUV(0, 2, 2);
    assert.deepEqual([map.offset.x, map.offset.y], [uv0.u, uv0.v]);
    builder.destroy();
  });

  await t.test('batch toggle flips animate across the selection', () => {
    const { builder } = makeBuilder();
    builder.importJson(JSON.stringify([
      makeProp({ id: 'anim_batch_1', animate: true }),
      makeProp({ id: 'anim_batch_2', animate: true }),
    ]));
    builder.selectMultipleProps(['anim_batch_1', 'anim_batch_2']);
    builder.setSelectedPropsAnimate(false);
    assert.equal(builder.hasPlayingAnimations(), false);
    builder.setSelectedPropsAnimate(true);
    assert.equal(builder.hasPlayingAnimations(), true);
    builder.destroy();
  });

  await t.test('static props never enter the animation path', () => {
    const { builder } = makeBuilder();
    builder.importJson(JSON.stringify([makeProp({ id: 'static_1', type: 'boulder_a', name: 'B' })]));
    assert.equal(builder.hasPlayingAnimations(), false);
    builder.updateAnimations(99.99);
    assert.equal(builder.hasPlayingAnimations(), false);
    builder.destroy();
  });
});

test('Animated: still <-> animated twins', async (t) => {
  await t.test('every sheet links back to the still art it was cut from', () => {
    const byType = new Map(PROP_DEFINITIONS.map((d) => [d.type, d]));
    let linked = 0;
    for (const [animType, srcUrl] of Object.entries(ANIMATED_SOURCE_ART)) {
      const animDef = byType.get(animType);
      assert.ok(animDef, `animated def exists: ${animType}`);
      assert.equal(animDef?.isAnimated, true);
      // the recorded source art is really used by an animated + a still def
      assert.ok(
        PROP_DEFINITIONS.some((d) => d.type === animType && d.url.startsWith('/art/animated/alpha/')),
        `${animType} is a sheet`,
      );
      assert.ok(
        PROP_DEFINITIONS.some((d) => d.url === srcUrl && !d.isAnimated),
        `a still decoration uses ${srcUrl}`,
      );
      const stillDef = PROP_DEFINITIONS.find((d) => d.type === animDef?.stillType);
      assert.ok(stillDef, `${animType} -> stillType resolves`);
      assert.equal(stillDef?.url, srcUrl, `${animType} twin shares the source art`);
      assert.equal(stillDef?.animatedTwin, animType, `${stillDef?.type} -> animatedTwin is reciprocal`);
      linked += 1;
    }
    assert.equal(linked, Object.keys(ANIMATED_SOURCE_ART).length,
      'every sheet that has still art to link to, links to it');
  });

  await t.test('anim_20 has no still counterpart and stays unlinked', () => {
    const def = PROP_DEFINITIONS.find((d) => d.type === 'anim_20_waterfall_splash_b');
    assert.ok(def);
    assert.equal(def?.stillType, undefined);
    assert.equal(ANIMATED_SOURCE_ART['anim_20_waterfall_splash_b'], undefined);
  });

  await t.test('twin pairs share an aspect ratio (swap never distorts)', () => {
    for (const def of PROP_DEFINITIONS) {
      const twin = animatedTwinDef(def);
      if (!twin) continue;
      const still = pngDims(join(here, '../public', def.url));
      const sheet = pngDims(join(alphaDir, twin.url.split('/').pop() as string));
      const stillAr = still.w / still.h;
      const frameAr = (sheet.w / 2) / (sheet.h / 2);
      assert.ok(
        Math.abs(stillAr - frameAr) < 0.02,
        `${def.type} aspect ${stillAr.toFixed(3)} matches ${twin.type} frame ${frameAr.toFixed(3)}`,
      );
    }
  });

  await t.test('art reuse by powerups/barriers does not hijack the link', () => {
    for (const def of PROP_DEFINITIONS) {
      if (!def.isPowerup && !def.isBarrier) continue;
      assert.equal(
        def.animatedTwin,
        undefined,
        `${def.type} reuses prop art but must not claim an animated twin`,
      );
    }
    assert.notEqual(
      PROP_DEFINITIONS.find((d) => d.type === 'prop_04_smelting_crucible')?.animatedTwin,
      undefined,
      'the canonical still prop keeps the twin',
    );
  });

  await t.test('frame skipping and speed are pure functions of the settings', () => {
    // unchecked frames are skipped, the loop runs over the enabled subset
    assert.equal(animFrameAt(0, 6, 4, 0, [true, false, true, false]), 0);
    assert.equal(animFrameAt(1 / 6 + 1e-6, 6, 4, 0, [true, false, true, false]), 2);
    assert.equal(animFrameAt(2 / 6 + 1e-6, 6, 4, 0, [true, false, true, false]), 0);
    // frames can be dropped from the middle and the end
    assert.equal(animFrameAt(1 / 6 + 1e-6, 6, 4, 0, [true, true, false, true]), 1);
    assert.equal(animFrameAt(2 / 6 + 1e-6, 6, 4, 0, [true, true, false, true]), 3);
    assert.equal(animFrameAt(3 / 6 + 1e-6, 6, 4, 0, [true, true, false, true]), 0);
    // nothing enabled falls back to frame 0 rather than disappearing
    assert.equal(animFrameAt(5, 6, 4, 0, [false, false, false, false]), 0);
    // missing entries count as enabled
    assert.equal(animFrameAt(1 / 6 + 1e-6, 6, 4, 0, [true, true]), 1);
    // speed is applied by the caller as an fps multiplier
    assert.equal(animFrameAt(0.25, 6 * 2, 4), animFrameAt(0.5, 6, 4));
    // helpers
    assert.deepEqual(animEnabledFrames({ animFrames: [true, false, true, false] }, 4), [0, 2]);
    assert.deepEqual(animEnabledFrames(undefined, 4), [0, 1, 2, 3]);
    // entries missing from a short array count as enabled
    assert.deepEqual(animEnabledFrames({ animFrames: [false, false] }, 4), [2, 3]);
    assert.deepEqual(animEnabledFrames({ animFrames: [false, false, false, false] }, 4), [0]);
    assert.equal(animSpeedFor(undefined), 1);
    assert.equal(animSpeedFor({ animSpeed: 99 }), ANIM_SPEED_MAX);
    assert.equal(animSpeedFor({ animSpeed: -5 }), ANIM_SPEED_MIN);
    assert.deepEqual(normalizeAnimFrames([true, false], 4), [true, false, true, true]);
    assert.deepEqual(normalizeAnimFrameDelays([0.5, -1, NaN, 1.25], 4), [0.5, 0, 0, 1.25]);
    assert.deepEqual(normalizeAnimFrameDelays(undefined, 3), [0, 0, 0]);

    // per-frame delays extend the hold duration of target frame(s)
    // frame 0 has 0.5s delay added to 1/6s base duration
    assert.equal(animFrameAt(0, 6, 4, 0, undefined, [0.5, 0, 0, 0]), 0);
    assert.equal(animFrameAt(0.5, 6, 4, 0, undefined, [0.5, 0, 0, 0]), 0);
    assert.equal(animFrameAt(1 / 6 + 0.5 + 1e-6, 6, 4, 0, undefined, [0.5, 0, 0, 0]), 1);
    assert.equal(animFrameAt(1 / 6 + 0.5 + 1 / 6 + 1e-6, 6, 4, 0, undefined, [0.5, 0, 0, 0]), 2);
    assert.equal(animFrameAt(1 / 6 + 0.5 + 2 / 6 + 1e-6, 6, 4, 0, undefined, [0.5, 0, 0, 0]), 3);
    assert.equal(animFrameAt(1 / 6 + 0.5 + 3 / 6 + 1e-6, 6, 4, 0, undefined, [0.5, 0, 0, 0]), 0);

    // frame skipping with delays
    assert.equal(animFrameAt(0.1, 6, 4, 0, [true, false, true, false], [0.3, 0, 0.4, 0]), 0);
    assert.equal(animFrameAt(1 / 6 + 0.3 + 1e-6, 6, 4, 0, [true, false, true, false], [0.3, 0, 0.4, 0]), 2);
  });
});

test('Animated: attribute-window controls', async (t) => {
  const stillType = 'prop_04_smelting_crucible';
  const stillUrl = '/art/props/alpha/prop-04-smelting-crucible.png';
  const twinType = 'anim_05_smelting_crucible';
  const twinUrl = '/art/animated/alpha/anim-05-smelting-crucible.png';

  function placeStill(builder: TrackBuilder3D, id: string): PlacedProp {
    const prop = makeProp({ id, type: stillType, name: 'Smelting Crucible' });
    builder.importJson(JSON.stringify([prop]));
    return prop;
  }

  await t.test('a still prop renders its own art until Animated is switched on', () => {
    const { scene, builder } = makeBuilder();
    const prop = placeStill(builder, 'swap_1');
    assert.equal(propHasAnimatedOption(prop), true);

    let map = spriteMap(scene, prop.id);
    assert.equal(map.name, stillUrl);
    assert.deepEqual([map.repeat.x, map.repeat.y], [1, 1], 'still art uses the whole texture');
    assert.equal(builder.hasPlayingAnimations(), false);

    builder.setPropAnimation(prop.id, { animated: true });
    map = spriteMap(scene, prop.id);
    assert.equal(map.name, twinUrl, 'sprite swapped to the animated sheet');
    assert.deepEqual([map.repeat.x, map.repeat.y], [0.5, 0.5], 'sheet shows one quadrant');
    assert.equal(builder.hasPlayingAnimations(), true);
    assert.equal(builder.getProps().find((p) => p.id === prop.id)?.animated, true);

    builder.setPropAnimation(prop.id, { animated: false });
    map = spriteMap(scene, prop.id);
    assert.equal(map.name, stillUrl, 'and back to the still art');
    assert.deepEqual([map.repeat.x, map.repeat.y], [1, 1]);
    builder.destroy();
  });

  await t.test('props without a twin ignore the animated flag', () => {
    const { scene, builder } = makeBuilder();
    const prop = makeProp({ id: 'swap_2', type: 'boulder_a', name: 'Boulder' });
    builder.importJson(JSON.stringify([prop]));
    assert.equal(propHasAnimatedOption(prop), false);
    builder.setPropAnimation(prop.id, { animated: true });
    const map = spriteMap(scene, prop.id);
    assert.equal(map.name, '/art/track-parts/rock-boulder-a.png');
    assert.deepEqual([map.repeat.x, map.repeat.y], [1, 1]);
    assert.equal(builder.getProps().find((p) => p.id === prop.id)?.animated, undefined);
    builder.destroy();
  });

  await t.test('the +/- speed control scales playback', () => {
    const { scene, builder } = makeBuilder();
    const prop = placeStill(builder, 'speed_1');
    builder.setPropAnimation(prop.id, { animated: true });
    const map = spriteMap(scene, prop.id);

    builder.setPropAnimation(prop.id, { animSpeed: 1 });
    builder.updateAnimations(0.5);
    const atHalfSecond = [map.offset.x, map.offset.y];

    builder.setPropAnimation(prop.id, { animSpeed: 2 });
    builder.updateAnimations(0.25);
    assert.deepEqual([map.offset.x, map.offset.y], atHalfSecond, '2x reaches the same frame in half the time');

    assert.equal(builder.getProps().find((p) => p.id === prop.id)?.animSpeed, 2);
    builder.setPropAnimation(prop.id, { animSpeed: 100 });
    assert.equal(animSpeedFor(builder.getProps().find((p) => p.id === prop.id)), ANIM_SPEED_MAX, 'clamped to the slider range');
    builder.destroy();
  });

  await t.test('unchecked frames are skipped by the loop', () => {
    const { scene, builder } = makeBuilder();
    const prop = placeStill(builder, 'frames_1');
    builder.setPropAnimation(prop.id, { animated: true, animFrames: [true, false, true, false] });
    const map = spriteMap(scene, prop.id);

    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      builder.updateAnimations(i * 0.05);
      seen.add(`${map.offset.x},${map.offset.y}`);
    }
    const allowed = [0, 2]
      .map((f) => animFrameUV(f, 2, 2))
      .map((uv) => `${uv.u},${uv.v}`)
      .sort();
    assert.deepEqual([...seen].sort(), allowed, 'only the checked frames are ever shown');

    // a single enabled frame holds still instead of cycling
    builder.setPropAnimation(prop.id, { animFrames: [false, true, false, false] });
    builder.updateAnimations(3.7);
    const held = animFrameUV(1, 2, 2);
    assert.deepEqual([map.offset.x, map.offset.y], [held.u, held.v]);
    assert.equal(builder.hasPlayingAnimations(), false, 'one frame left = nothing to play');

    builder.destroy();
  });

  await t.test('settings survive a save/load round trip', () => {
    const { scene, builder } = makeBuilder();
    const prop = placeStill(builder, 'persist_1');
    builder.setPropAnimation(prop.id, { animated: true, animSpeed: 1.5, animFrames: [true, true, false, true] });
    const saved = JSON.parse(JSON.stringify(builder.getProps()));
    builder.destroy();

    const { scene: scene2, builder: builder2 } = makeBuilder();
    builder2.importJson(JSON.stringify(saved));
    const restored = builder2.getProps().find((p) => p.id === 'persist_1') as PlacedProp;
    assert.equal(restored.animated, true);
    assert.equal(restored.animSpeed, 1.5);
    assert.deepEqual(restored.animFrames, [true, true, false, true]);
    const map = spriteMap(scene2, 'persist_1');
    assert.equal(map.name, twinUrl, 'restored prop keeps the animated sheet');
    builder2.updateAnimations(0);
    assert.deepEqual([map.repeat.x, map.repeat.y], [0.5, 0.5]);
    builder2.destroy();
  });

  await t.test('batch controls apply across the selection', () => {
    const { scene, builder } = makeBuilder();
    builder.importJson(JSON.stringify([
      makeProp({ id: 'batch_1', type: stillType, name: 'A' }),
      makeProp({ id: 'batch_2', type: stillType, name: 'B' }),
      makeProp({ id: 'batch_3', type: 'boulder_a', name: 'C' }),
    ]));
    builder.selectMultipleProps(['batch_1', 'batch_2', 'batch_3']);

    builder.setSelectedPropsAnimated(true);
    assert.equal(spriteMap(scene, 'batch_1').name, twinUrl);
    assert.equal(spriteMap(scene, 'batch_2').name, twinUrl);
    assert.equal(spriteMap(scene, 'batch_3').name, '/art/track-parts/rock-boulder-a.png', 'twinless prop untouched');

    builder.nudgeSelectedAnimSpeed(ANIM_SPEED_STEP);
    for (const id of ['batch_1', 'batch_2']) {
      assert.equal(animSpeedFor(builder.getProps().find((p) => p.id === id)), 1 + ANIM_SPEED_STEP);
    }

    builder.setSelectedPropsAnimation({ animFrames: [true, true, true, false] });
    for (const id of ['batch_1', 'batch_2']) {
      assert.deepEqual(builder.getProps().find((p) => p.id === id)?.animFrames, [true, true, true, false]);
    }

    builder.setSelectedPropsAnimated(false);
    assert.equal(spriteMap(scene, 'batch_1').name, stillUrl);
    assert.equal(spriteMap(scene, 'batch_2').name, stillUrl);
    builder.destroy();
  });

  await t.test('an animated-category prop exposes the same speed/frame controls', () => {
    const { scene, builder } = makeBuilder();
    const prop = makeProp({ id: 'anim_ctrl_1', type: twinType, name: 'Smelting Crucible (Animated)' });
    builder.importJson(JSON.stringify([prop]));
    assert.equal(spriteMap(scene, prop.id).name, twinUrl);

    builder.setPropAnimation(prop.id, { animSpeed: 0.5, animFrames: [true, false, false, true] });
    const stored = builder.getProps().find((p) => p.id === prop.id) as PlacedProp;
    assert.equal(stored.animSpeed, 0.5);
    assert.deepEqual(stored.animFrames, [true, false, false, true]);
    // the swap flag is meaningless for a sheet-only prop and is left alone
    assert.equal(stored.animated, undefined);

    // speed + frame mask feed the same loop (frame 1 and 2 stay skipped)
    const map = spriteMap(scene, prop.id);
    const grid = animGridFor(PROP_DEFINITIONS.find((d) => d.type === twinType) as PropDefinition);
    const phase = animPhaseFor(prop.id, grid.cols * grid.rows);
    const allowed = [0, 3].map((f) => animFrameUV(f, grid.cols, grid.rows)).map((uv) => `${uv.u},${uv.v}`);
    for (const t of [0, 0.4, 1.7, 9.25]) {
      builder.updateAnimations(t);
      const shown = `${map.offset.x},${map.offset.y}`;
      assert.ok(allowed.includes(shown), `frame at t=${t} is one of the checked frames (${shown})`);
      const expected = animFrameUV(
        animFrameAt(t, grid.fps * 0.5, grid.cols * grid.rows, phase, [true, false, false, true]),
        grid.cols,
        grid.rows,
      );
      assert.deepEqual([map.offset.x, map.offset.y], [expected.u, expected.v], `t=${t} honours speed 0.5`);
    }
    builder.destroy();
  });

  await t.test('per-frame delay controls save/load and drive frame holds', () => {
    const { scene, builder } = makeBuilder();
    const prop = placeStill(builder, 'delay_test_1');
    builder.setPropAnimation(prop.id, {
      animated: true,
      animFrameDelays: [0.5, 0, 0, 0],
    });

    const stored = builder.getProps().find((p) => p.id === prop.id) as PlacedProp;
    assert.deepEqual(stored.animFrameDelays, [0.5, 0, 0, 0]);

    // Frame hold drives UV updates
    const map = spriteMap(scene, prop.id);
    const grid = animGridFor(PROP_DEFINITIONS.find((d) => d.type === twinType) as PropDefinition);
    const phase = animPhaseFor(prop.id, grid.cols * grid.rows);
    for (const t of [0, 0.2, 0.4, 0.8, 1.5]) {
      builder.updateAnimations(t);
      const expectedFrame = animFrameAt(t, grid.fps, grid.cols * grid.rows, phase, undefined, [0.5, 0, 0, 0]);
      const expectedUv = animFrameUV(expectedFrame, grid.cols, grid.rows);
      assert.deepEqual([map.offset.x, map.offset.y], [expectedUv.u, expectedUv.v], `t=${t} honours frame 0 delay`);
    }

    builder.destroy();
  });

  await t.test('setAllPropsAnimated switches all twin-capable props and back', () => {
    const { scene, builder } = makeBuilder();
    // 2 props with twins, 1 prop without twin
    const p1 = placeStill(builder, 'all_twin_1');
    const p2 = placeStill(builder, 'all_twin_2');
    const noTwin = makeProp({ id: 'no_twin_1', type: 'prop_09_pine_lookout', name: 'Pine Lookout' });
    builder.importJson(JSON.stringify([p1, p2, noTwin]));

    // All still initially
    assert.equal(spriteMap(scene, p1.id).name, stillUrl);
    assert.equal(spriteMap(scene, p2.id).name, stillUrl);

    // Switch all to animated
    const count = builder.setAllPropsAnimated(true);
    assert.equal(count, 2, 'switched both twin props');
    assert.equal(builder.getProps().find((p) => p.id === p1.id)?.animated, true);
    assert.equal(builder.getProps().find((p) => p.id === p2.id)?.animated, true);
    assert.equal(builder.getProps().find((p) => p.id === noTwin.id)?.animated, undefined);
    assert.equal(spriteMap(scene, p1.id).name, twinUrl);
    assert.equal(spriteMap(scene, p2.id).name, twinUrl);

    // Switch all back to still
    const backCount = builder.setAllPropsAnimated(false);
    assert.equal(backCount, 2, 'switched both back to still');
    assert.equal(builder.getProps().find((p) => p.id === p1.id)?.animated, false);
    assert.equal(builder.getProps().find((p) => p.id === p2.id)?.animated, false);
    assert.equal(spriteMap(scene, p1.id).name, stillUrl);
    assert.equal(spriteMap(scene, p2.id).name, stillUrl);

    builder.destroy();
  });
});
