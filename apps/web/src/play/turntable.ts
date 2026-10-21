/**
 * The bench's preview stage (plan 39 section 6): a small WebGL view that turns slowly, orbits on drag and zooms on the
 * wheel, lit like a product shot, with a ground grid. The part, species and light pages each feed it their object. It
 * lives only while its page is open; dispose() releases its WebGL context (the min-spec laptop: a GTX 950M).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Turntable {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly grid: THREE.GridHelper;
  /** Runs every frame before the render (t in seconds since the stage opened): what moves in the preview. */
  onFrame: ((t: number) => void) | null;
  /** Points the camera at a box from a three-quarter angle above, its bounding sphere filling the view. */
  fit(min: readonly number[], max: readonly number[]): void;
  dispose(): void;
}

/** Frames a box for `camera` about `target` (moved to the box's centre); the bounding sphere fills the vertical view. */
export function frameBox(camera: THREE.PerspectiveCamera, target: THREE.Vector3, min: readonly number[], max: readonly number[]): void {
  const dx = (max[0] ?? 0) - (min[0] ?? 0), dy = (max[1] ?? 0) - (min[1] ?? 0), dz = (max[2] ?? 0) - (min[2] ?? 0);
  const r = 0.5 * Math.hypot(dx, dy, dz);
  const dist = (Math.max(r, 0.005) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.02;
  target.set(((min[0] ?? 0) + (max[0] ?? 0)) / 2, ((min[1] ?? 0) + (max[1] ?? 0)) / 2, ((min[2] ?? 0) + (max[2] ?? 0)) / 2);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(1, 0.95, 1.35).normalize(), dist);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

/**
 * A chip's thumbnail: `object` alone on the stage (its lights kept, everything else hidden), framed from the preview's
 * angle, rendered through the stage's own context at twice the size and drawn down (smooth edges without multisampling).
 * Returns a PNG data URL.
 */
export function snapshot(stage: Turntable, object: THREE.Object3D, size = 96): string {
  const S = size * 2;
  const hidden = stage.scene.children.filter((c) => c.visible && c !== object && !(c as THREE.Light).isLight);
  for (const c of hidden) c.visible = false;
  const added = object.parent !== stage.scene;
  if (added) stage.scene.add(object);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 1000);
  frameBox(camera, new THREE.Vector3(), box.min.toArray(), box.max.toArray());
  const rt = new THREE.WebGLRenderTarget(S, S);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const px = new Uint8Array(S * S * 4);
  stage.renderer.setRenderTarget(rt);
  stage.renderer.clear();
  stage.renderer.render(stage.scene, camera);
  stage.renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
  stage.renderer.setRenderTarget(null);
  rt.dispose();
  if (added) stage.scene.remove(object);
  for (const c of hidden) c.visible = true;
  const big = document.createElement('canvas');
  big.width = big.height = S;
  const small = document.createElement('canvas');
  small.width = small.height = size;
  const bigCtx = big.getContext('2d'), smallCtx = small.getContext('2d');
  if (!bigCtx || !smallCtx) return '';
  const img = bigCtx.createImageData(S, S);
  for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  bigCtx.putImageData(img, 0, 0);
  smallCtx.drawImage(big, 0, 0, size, size);
  return small.toDataURL('image/png');
}

export function createTurntable(canvas: HTMLCanvasElement): Turntable {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 1.6;
  // a hand on the object stops the turntable; it stays where it was left
  const stop = (): void => { controls.autoRotate = false; };
  controls.addEventListener('start', stop);
  // a product-shot rig: a bright sky fill, a warm key from above right, a front fill and a cool rim, so dark metals read
  scene.add(new THREE.HemisphereLight(0xe8f1fa, 0x2a3442, 2.2));
  const key = new THREE.DirectionalLight(0xfff3e0, 3.2);
  key.position.set(3, 5, 4);
  const fill = new THREE.DirectionalLight(0xdfe9f3, 1.2);
  fill.position.set(-2, 1, 4);
  const rim = new THREE.DirectionalLight(0x5fd4ff, 1.4);
  rim.position.set(-4, 2, -3);
  scene.add(key, fill, rim);
  const grid = new THREE.GridHelper(1, 10, 0x2c3d51, 0x1c2734);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.55;
  scene.add(grid);

  const size = (): void => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(size);
  observer.observe(canvas);
  size();
  const t0 = performance.now();
  let raf = 0;
  const view: Turntable = {
    renderer, scene, camera, controls, grid,
    onFrame: null,
    fit(min, max) {
      frameBox(camera, controls.target, min, max);
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.removeEventListener('start', stop);
      controls.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  const loop = (): void => {
    raf = requestAnimationFrame(loop);
    view.onFrame?.((performance.now() - t0) / 1000);
    controls.update();
    renderer.render(scene, camera);
  };
  loop();
  return view;
}
