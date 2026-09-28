import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PostProcessingPipeline } from '../src/game/postfx/pipeline';

function createMockRenderer(): THREE.WebGLRenderer {
  const passes: string[] = [];
  return {
    toneMapping: THREE.NoToneMapping,
    autoClear: true,
    render(scene: any, camera: any) {
      passes.push(`render_${scene.name || 'scene'}`);
    },
    setRenderTarget(target: any) {
      passes.push(target ? 'set_target_hdr' : 'set_target_screen');
    },
    clear() {
      passes.push('clear');
    },
    dispose() {},
    _passes: passes,
  } as unknown as THREE.WebGLRenderer;
}

test('T7 PostFxPipeline: medium quality direct render pass with ACES tone mapping', () => {
  const renderer = createMockRenderer();
  const pipeline = new PostProcessingPipeline(renderer, { quality: 'medium' });

  const scene = new THREE.Scene();
  scene.name = 'MainScene';
  const camera = new THREE.PerspectiveCamera();

  pipeline.render(scene, camera);

  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  const p = (renderer as any)._passes;
  assert.equal(p.length, 1);
  assert.equal(p[0], 'render_MainScene');
});

test('T7 PostFxPipeline: low quality direct render pass with no tone mapping', () => {
  const renderer = createMockRenderer();
  const pipeline = new PostProcessingPipeline(renderer, { quality: 'low' });

  const scene = new THREE.Scene();
  scene.name = 'MainScene';
  const camera = new THREE.PerspectiveCamera();

  pipeline.render(scene, camera);

  assert.equal(renderer.toneMapping, THREE.NoToneMapping);
  const p = (renderer as any)._passes;
  assert.equal(p.length, 1);
  assert.equal(p[0], 'render_MainScene');
});

test('T7 PostFxPipeline: overlay rendered after main post scene', () => {
  const renderer = createMockRenderer();
  const pipeline = new PostProcessingPipeline(renderer, { quality: 'medium' });

  const scene = new THREE.Scene();
  scene.name = 'MainScene';
  const overlay = new THREE.Scene();
  overlay.name = 'OverlayUI';
  const camera = new THREE.PerspectiveCamera();

  pipeline.render(scene, camera, overlay);

  const p = (renderer as any)._passes;
  assert.equal(p.length, 2);
  assert.equal(p[0], 'render_MainScene');
  assert.equal(p[1], 'render_OverlayUI');
});
