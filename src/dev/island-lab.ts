/**
 * Dev-only island lab (island-lab.html): the owner's island model on its own, with views and probes
 * used to find the carved grooves and lay the race paths in them. Not part of the game build.
 */
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MODEL_TO_ROUTE } from '../game/island-route/serpentine-route';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb7bd');
scene.add(new THREE.HemisphereLight('#dfeef2', '#6b5a44', 1.6));
const sun = new THREE.DirectionalLight('#fff3dc', 2.2);
sun.position.set(-60, 120, -40);
scene.add(sun);

const persp = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
persp.position.set(0, 220, 220);
const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1000);
ortho.position.set(0, 300, 0);
ortho.up.set(0, 0, -1);
ortho.lookAt(0, 0, 0);
let camera: THREE.Camera = persp;
const controls = new OrbitControls(persp, renderer.domElement);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  persp.aspect = w / h; persp.updateProjectionMatrix();
  const a = w / h;
  ortho.left = -100 * a; ortho.right = 100 * a; ortho.top = 100; ortho.bottom = -100; ortho.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const texture = new THREE.TextureLoader().load('/models/island/serpentine-isle.jpg');
texture.colorSpace = THREE.SRGBColorSpace;
let island: THREE.Mesh | null = null;
new OBJLoader().load('/models/island/serpentine-isle.obj', (group) => {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
      island = mesh;
    }
  });
  // The OBJ is exported at a hundredth of the route's units; the lab works in route units.
  group.scale.setScalar(MODEL_TO_ROUTE);
  group.updateMatrixWorld(true);
  scene.add(group);
});

const markers = new THREE.Group();
scene.add(markers);

function frame() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

/** Probes for the console / automation. */
(window as unknown as Record<string, unknown>).lab = {
  THREE, scene, renderer, get island() { return island; }, texture, markers,
  top(half = 100, cx = 0, cz = 0) {
    const a = window.innerWidth / window.innerHeight;
    ortho.left = cx - half * a; ortho.right = cx + half * a; ortho.top = -cz + half; ortho.bottom = -cz - half;
    ortho.position.set(0, 300, 0); ortho.lookAt(0, 0, 0); ortho.updateProjectionMatrix();
    camera = ortho; renderer.render(scene, camera);
  },
  view(x: number, y: number, z: number, tx = 0, ty = 0, tz = 0) {
    persp.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update();
    camera = persp; renderer.render(scene, camera);
  },
  /** Height of the island surface under (x, z), from a ray cast straight down. */
  heightAt(x: number, z: number): number | null {
    if (!island) return null;
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(island, false)[0];
    return hit ? hit.point.y : null;
  },
  /** Drops a small marker (for checking a path). */
  mark(points: { x: number; y: number; z: number }[], color = '#ff3b30', size = 0.6) {
    const geo = new THREE.SphereGeometry(size, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (const p of points) { const m = new THREE.Mesh(geo, mat); m.position.set(p.x, p.y, p.z); markers.add(m); }
  },
  clearMarks() { markers.clear(); },
};
