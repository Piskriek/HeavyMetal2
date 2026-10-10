// Dev-only mesh gallery for reviewing Arena mesh answers side by side (not part of the game bundle).
//   /gallery.html?mod=basegear2/r2B&fns=hardpoint,heavyMill,bin,repeater,draftingTable[&spacing=10][&view=front]
// Row 1 is stage 1, row 2 is stage 6, on sandy ground under a low warm sun, with a 1.8 m scale post per column.
import * as THREE from 'three';

const modules = import.meta.glob('../../../../arena-gathered/*/*/src/index.ts');
const q = new URLSearchParams(location.search);
const modKey = q.get('mod') ?? '';
const fns = (q.get('fns') ?? '').split(',').filter(Boolean);
const spacing = Number(q.get('spacing') ?? 10);
const info = document.getElementById('info')!;

async function main(): Promise<void> {
  const entry = Object.entries(modules).find(([k]) => k.includes(`/arena-gathered/${modKey}/src/index.ts`));
  if (!entry) { info.textContent = `no module for mod=${modKey}; have: ${Object.keys(modules).map((k) => k.split('arena-gathered/')[1]?.replace('/src/index.ts', '')).join(', ')}`; return; }
  const mod = (await entry[1]()) as Record<string, unknown>;
  const m = (mod['createMaterials'] as () => unknown)();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fb3c8');
  scene.fog = new THREE.Fog('#9fb3c8', 80, 220);
  scene.add(new THREE.HemisphereLight('#dfe9f5', '#7a6a55', 0.9));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.position.set(-30, 40, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 160 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#b9a27f', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const tris: string[] = [];
  fns.forEach((name, col) => {
    const build = mod[name] as ((mm: unknown, o: unknown) => { group: THREE.Object3D }) | undefined;
    [1, 6].forEach((stage, row) => {
      if (!build) return;
      const g = build(m, { stage }).group;
      g.position.set(col * spacing, 0, -row * spacing);
      g.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
      scene.add(g);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 0.15), new THREE.MeshStandardMaterial({ color: '#ff3b6b' }));
      post.position.set(col * spacing - 1, 0.9, -row * spacing + 1);
      scene.add(post);
      let t = 0; g.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { const geo = mesh.geometry; t += (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3; } });
      tris.push(`${name} s${stage}: ${Math.round(t)}`);
    });
  });
  // fit the camera to everything placed (three-quarter view from the front-right, or straight on with view=front)
  const all = new THREE.Box3();
  scene.children.forEach((o) => { if (o !== ground && !(o instanceof THREE.Light)) all.expandByObject(o); });
  const centre = all.getCenter(new THREE.Vector3()), size = all.getSize(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 800);
  const front = q.get('view') === 'front';
  const fit = Math.max(size.x / camera.aspect, size.z, size.y) / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.15;
  camera.position.set(centre.x + (front ? 0 : fit * 0.35), centre.y + fit * (front ? 0.25 : 0.6), centre.z + fit * 0.9);
  camera.lookAt(centre);
  renderer.render(scene, camera);
  info.textContent = `${modKey} · ${tris.join(' · ')}`;
  (window as unknown as { __galleryReady: boolean }).__galleryReady = true;
}
main().catch((e: unknown) => { info.textContent = `error: ${String(e)}`; });
