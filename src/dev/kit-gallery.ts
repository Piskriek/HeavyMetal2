/**
 * Dev-only gallery of the Meshy models (kit-gallery.html, served by the dev server, not in the build):
 * one model at a time on a lit sand stage, orbit controls, and a switch between the full, low and
 * collision tiers, with each file's triangle count and size.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadGlb } from '../game/models/glb';

const GROUPS: [string, (id: string) => boolean][] = [
  ['Stunts', (id) => id.startsWith('stunt-')],
  ['Landmarks', (id) => id.startsWith('sea-')],
  ['Kit', () => true],
];
const pretty = (id: string) => id.replace(/^stunt-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

const main = document.querySelector('main')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
main.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb7b2');
scene.fog = new THREE.Fog('#9fb7b2', 12, 30);
scene.add(new THREE.HemisphereLight(0xfff1d6, 0x3a4a44, 1.3));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
sun.position.set(-4, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
camera.position.set(4.4, 2.9, 5.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.6, 0);

let ids: string[] = [];
let current = 0;
let tier = '';
let shown: THREE.Object3D | null = null;
let token = 0;

async function show(index: number) {
  current = (index + ids.length) % ids.length;
  const id = ids[current];
  const mine = ++token;
  document.querySelectorAll('li button').forEach((b) => b.setAttribute('aria-current', String(b.getAttribute('data-id') === id)));
  document.getElementById('name')!.textContent = pretty(id);
  let url = `/models/kit/${id}${tier}.glb`;
  if (tier === '.drive') {
    // The dev server answers a missing file with its HTML page, so check the type, not just the status.
    const probe = await fetch(url, { method: 'HEAD' });
    if (!probe.ok || probe.headers.get('content-type')?.includes('html')) url = `/models/kit/${id}.glb`;
  }
  const [model, head] = await Promise.all([loadGlb(url), fetch(url, { method: 'HEAD' })]);
  if (mine !== token) return;
  if (shown) scene.remove(shown);
  const o = model.clone(true);
  // Fit every model to the same footprint, standing on the stage.
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3());
  const s = 3 / Math.max(size.x, size.z, size.y);
  o.scale.setScalar(s);
  const fitted = new THREE.Box3().setFromObject(o);
  o.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  let tris = 0;
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    tris += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
    if (tier === '.collision') mesh.material = new THREE.MeshStandardMaterial({ color: '#c46f3a', flatShading: true, roughness: 0.9 });
    if (tier === '.drive') { mesh.material = new THREE.MeshStandardMaterial({ color: '#e0a13a', flatShading: false, roughness: 0.7, side: THREE.DoubleSide }); mesh.geometry.computeVertexNormals(); }
  });
  scene.add(o);
  shown = o;
  controls.target.set(0, (fitted.max.y - fitted.min.y) / 2, 0);
  const bytes = Number(head.headers.get('content-length') ?? 0);
  document.getElementById('stats')!.textContent = `${tris.toLocaleString()} triangles · ${(bytes / 1e6).toFixed(2)} MB · ${tier ? tier.slice(1) : 'full'} tier`;
}

function list() {
  const ul = document.getElementById('list')!;
  const placed = new Set<string>();
  for (const [name, test] of GROUPS) {
    const members = ids.filter((id) => !placed.has(id) && test(id));
    if (!members.length) continue;
    const head = document.createElement('li');
    head.className = 'group';
    head.textContent = name;
    ul.append(head);
    for (const id of members) {
      placed.add(id);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.dataset.id = id;
      b.innerHTML = `<span>${pretty(id)}</span>`;
      b.onclick = () => void show(ids.indexOf(id));
      li.append(b);
      ul.append(li);
    }
  }
}

function resize() {
  const r = main.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}

document.querySelectorAll<HTMLButtonElement>('.tiers button').forEach((b) => {
  b.onclick = () => {
    tier = b.dataset.tier ?? '';
    document.querySelectorAll('.tiers button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    void show(current);
  };
});
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') void show(current + 1);
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') void show(current - 1);
});
addEventListener('resize', resize);

ids = await (await fetch('/models/kit/index.json')).json();
// Stunts first, then landmarks, then the kit, in the list's order.
ids = GROUPS.flatMap(([, test], gi) => ids.filter((id) => test(id) && !GROUPS.slice(0, gi).some(([, t]) => t(id))));
list();
resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
void show(0);
