/**
 * Animated decorations (4-frame 2x2 sheets).
 *
 * Validates:
 * - Frame math: grid defaults, frame timing/looping, row-major UVs, id phases
 * - Registry: 10 animated entries with unique types, 2x2 grids, positive fps
 * - Sheets on disk: keyed alpha files exist with even (cuttable) dimensions
 * - Headless builder: offsets advance per frame, animate=false and reduced
 *   motion freeze on frame 0, batch toggle flips the flag
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  TrackBuilder3D,
  PROP_DEFINITIONS,
  animGridFor,
  animFrameAt,
  animFrameUV,
  animPhaseFor,
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

  await t.test('exactly 10 animated decorations are registered', () => {
    assert.equal(animated.length, 10);
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
