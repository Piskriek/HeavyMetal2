/**
 * Thumbnails for the content browser: each packed asset's low level, drawn once on a small offscreen renderer and kept
 * as a picture. Lazy: the browser asks for a thumbnail when its row scrolls into view, and the renders run one at a time
 * (one WebGL context, not one per row). forgetThumb() drops one after a redo changed the asset.
 */
import * as THREE from 'three';
import { loadGenRaw } from '../assets/gen';
import { enqueueOffscreenRender, getSharedOffscreenRenderer } from './offscreen-renderer';

const SIZE = 96;
const done = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/** One thumbnail as a data URL, or null for an asset that cannot be drawn. Cached after the first render. */
export function thumbOf(id: string): Promise<string | null> {
  const hit = done.get(id);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(id);
  if (running) return running;
  const p = enqueueOffscreenRender(() => draw(id)).catch(() => null);
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
  const { renderer: r, scene: s, camera: c } = getSharedOffscreenRenderer(SIZE);
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
