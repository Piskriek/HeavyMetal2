import * as THREE from 'three';
import { VoxelView } from '@hm/render';
import type { VoxelModel } from '@hm/voxel';

/**
 * Thumbnails rendered FROM the preset itself ("preset examples rather than text"): one shared offscreen renderer draws a voxel model from a
 * three-quarter view, auto-framed, on a transparent background, and hands back a PNG data URL. Results are cached by a cheap content key.
 */
let shared: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; size: number } | null = null;
const cache = new Map<string, string>();

function setup(size: number): NonNullable<typeof shared> {
  if (shared && shared.size === size) return shared;
  shared?.renderer.dispose();
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff3df, 0x9aa7b8, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-0.6, 1, 0.8);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  shared = { renderer, scene, camera, size };
  return shared;
}

const keyOf = (m: VoxelModel, size: number, yaw: number): string => {
  let h = 2166136261;
  for (let i = 0; i < m.cells.length; i += 7) h = Math.imul(h ^ m.cells[i]!, 16777619);
  const pal = m.palette.map((p) => p.color.map((v) => Math.round(v * 255)).join(',')).join('|');
  return `${m.id}:${m.size.join('x')}:${m.cells.length}:${h >>> 0}:${pal}:${size}:${yaw}`;
};

export function renderThumb(model: VoxelModel, size = 128, yawDeg = 35): string {
  const k = keyOf(model, size, yawDeg);
  const hit = cache.get(k);
  if (hit) return hit;
  const s = setup(size);
  const view = new VoxelView(model, { ao: true, greedy: true, scale: 1 });
  const box = new THREE.Box3().setFromObject(view.group);
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
  const dist = radius / Math.sin((s.camera.fov * Math.PI) / 360) * 1.05;
  const yaw = (yawDeg * Math.PI) / 180;
  s.camera.position.set(centre.x + Math.sin(yaw) * dist * 0.85, centre.y + dist * 0.38, centre.z - Math.cos(yaw) * dist * 0.85);
  s.camera.lookAt(centre);
  s.scene.add(view.group);
  s.renderer.render(s.scene, s.camera);
  const url = s.renderer.domElement.toDataURL('image/png');
  s.scene.remove(view.group);
  view.dispose();
  cache.set(k, url);
  return url;
}
