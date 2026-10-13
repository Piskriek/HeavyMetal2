/**
 * Thumbnails for the content browser: each packed asset's low level, drawn once on a small offscreen renderer and kept
 * as a picture. Lazy: the browser asks for a thumbnail when its row scrolls into view, and the renders run one at a time
 * (one WebGL context, not one per row). forgetThumb() drops one after a redo changed the asset.
 */
import * as THREE from 'three';
import { loadGenRaw } from '../assets/gen';

const SIZE = 96;
const done = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function ensure(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  if (!renderer || !scene || !camera) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xd6ecff, 0x18120a, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 6, 4);
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
  }
  return { renderer, scene, camera };
}

/** One thumbnail as a data URL, or null for an asset that cannot be drawn. Cached after the first render. */
export function thumbOf(id: string): Promise<string | null> {
  const hit = done.get(id);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(id);
  if (running) return running;
  const p: Promise<string | null> = chain.then(() => draw(id)).catch(() => null);
  chain = p;
  pending.set(id, p);
  void p.then((url) => { if (url) done.set(id, url); pending.delete(id); });
  return p;
}

/** Drops one asset's thumbnail, so the next request draws it again (after a redo changed its model). */
export function forgetThumb(id: string): void {
  done.delete(id);
  pending.delete(id);
}

async function draw(id: string): Promise<string | null> {
  const raw = await loadGenRaw(id, 'low');
  const { renderer: r, scene: s, camera: c } = ensure();
  const model = raw.clone(true);
  s.add(model);
  try {
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return null;
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) / 2 || 0.5;
    const dist = radius / Math.sin((c.fov * Math.PI) / 360) * 1.05;
    // a three-quarter view, from above
    c.position.set(centre.x + dist * 0.62, centre.y + dist * 0.42, centre.z + dist * 0.66);
    c.lookAt(centre);
    c.aspect = 1;
    c.updateProjectionMatrix();
    r.render(s, c);
    return r.domElement.toDataURL('image/png');
  } finally {
    s.remove(model);
  }
}
