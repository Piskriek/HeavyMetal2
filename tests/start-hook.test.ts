/**
 * The start hook: the test ball can hang above what is under it (Shift-drag, or the Hook field), and a
 * test drive then starts with the drop: no push, the ball falls, lands (on a ramp deck if one is under
 * it) and rolls onto the nearest lane. Also: the painted dirt's cracks live in the detail tile.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import { DETAIL_RES, makeDetailTile, normalizeIslandGround } from '../src/game/island-route/island-ground';
import type { TrackData } from '../src/game/renderer-3d';

function mockStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); }, clear: () => data.clear(), key: () => null, get length() { return data.size; },
  } as Storage;
}

test('the test ball keeps its hook height when moved, and hands it to the test drive', () => {
  (globalThis as any).localStorage = mockStorage();
  const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
  const builder = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'none');
  builder.setTestBall({ x: 2000, z: 0, world: { x: 0, y: 500, z: 0 } });
  builder.setTestBallHeight(800);
  assert.deepEqual(builder.getTestBall(), { x: 2000, z: 0, height: 800 });
  builder.setTestBall({ x: 2400, z: 100, world: { x: 10, y: 480, z: 5 } });
  assert.equal(builder.getTestBallHeight(), 800, 'sliding it over the ground keeps it on the hook');
  builder.setTestBallHeight(-50);
  assert.deepEqual(builder.getTestBall(), { x: 2400, z: 100 }, 'lowered to the ground: no hook');
  builder.setTestBallHeight(1e9);
  assert.equal(builder.getTestBallHeight(), TrackBuilder3D.TEST_BALL_MAX_HEIGHT);
});

test('a hooked test ball starts in the air and the race starts with the drop, not the push', () => {
  const e = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(e, /player\.y = this\.world\.surfaceAt\(x, z\)\.y - RADIUS - height;/);
  assert.match(e, /player\.grounded = height <= 0;/);
  assert.match(e, /this\.snapshot\.status = this\.dropStart \? 'flying' : 'pushing';/);
  const ui = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  assert.match(ui, /if \(e\.shiftKey\) \{\s*const height = builder\.testBallHeightAt/);
});

test('the painted dirt: cracks in the tile, its own scale, old saves still load', () => {
  const tile = makeDetailTile(DETAIL_RES);
  let cracked = 0;
  for (let i = 3; i < tile.length; i += 4) if (tile[i] > 128) cracked++;
  const share = cracked / (DETAIL_RES * DETAIL_RES);
  assert.ok(share > 0.02 && share < 0.3, `cracks are thin lines (${(share * 100).toFixed(1)}% of the tile)`);
  assert.equal(normalizeIslandGround({ sandPits: 0.4 }).sandScale, 1, 'a save from before the scale loads at 1x');
  assert.equal(normalizeIslandGround({ sandScale: 99 }).sandScale, 4);
});

test('the attribute window scrolls instead of squashing its rows (the tab row with Animation stayed visible)', () => {
  const ui = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  const panels = ui.match(/w-80 max-h-\[calc\(100vh-17rem\)\] overflow-y-auto[^"]*/g) ?? [];
  assert.equal(panels.length, 3, 'single, group and island ground panels');
  for (const panel of panels) assert.match(panel, /\[&>\*\]:shrink-0/, 'no row may shrink');
});
