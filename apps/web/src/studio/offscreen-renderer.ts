/**
// ============================================================================
// File: apps/web/src/studio/offscreen-renderer.ts
// Shared offscreen WebGL renderer singleton for four-angle review and thumbnails (POL-92).
// Prevents multiple WebGL contexts and memory pressure on lower-end GPUs (e.g. GTX 950M).
// ============================================================================
 */

import * as THREE from 'three';

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.PerspectiveCamera | null = null;
let renderQueue: Promise<unknown> = Promise.resolve();

export interface OffscreenContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
}

export function getSharedOffscreenRenderer(size: number): OffscreenContext {
  if (!sharedRenderer || !sharedScene || !sharedCamera) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    sharedRenderer.setPixelRatio(1);
    sharedRenderer.setClearColor(0x000000, 0);

    sharedScene = new THREE.Scene();
    sharedScene.add(new THREE.HemisphereLight(0xd6ecff, 0x18120a, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 6, 4);
    sharedScene.add(sun);

    sharedCamera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
  }

  sharedRenderer.setSize(size, size, false);
  return {
    renderer: sharedRenderer,
    scene: sharedScene,
    camera: sharedCamera,
  };
}

/**
 * Runs a render task exclusively on the shared offscreen render queue,
 * guaranteeing serialized rendering so thumb and angle renders never collide.
 */
export function enqueueOffscreenRender<T>(task: () => Promise<T>): Promise<T> {
  const p = renderQueue.then(task);
  renderQueue = p.catch(() => undefined);
  return p;
}
