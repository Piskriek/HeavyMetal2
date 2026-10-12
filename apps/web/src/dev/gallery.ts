// Dev-only mesh gallery for reviewing Arena mesh answers side by side (not part of the game bundle).
//   /gallery.html?mod=basegear2/r2B&fns=hardpoint,heavyMill,bin,repeater,draftingTable[&spacing=10][&view=front][&ground=-2.6]
//   Rovers (a body, a wheel and hubs, as rovergear returns) are assembled with a wheel at each hub: mod=rovergear/B&fns=scout,hauler,crawler,fabricator
// Row 1 is stage 1, row 2 is stage 6, on sandy ground under a low warm sun, with a 1.8 m scale post per column.
/// <reference types="vite/client" />
import * as THREE from 'three';

const modules = import.meta.glob<Record<string, unknown>>('../../../../arena-gathered/*/*/src/index.ts');
// landed packages too: mod=pkg/rovergear
const packages = import.meta.glob<Record<string, unknown>>('../../../../packages/*/src/index.ts');
const q = new URLSearchParams(location.search);
const modKey = q.get('mod') ?? '';
const fns = (q.get('fns') ?? '').split(',').filter(Boolean);
const spacing = Number(q.get('spacing') ?? 10);
const info = document.getElementById('info')!;

async function main(): Promise<void> {
  if (q.has('rovers')) { await rovers(); return; }
  const entry = modKey.startsWith('pkg/')
    ? Object.entries(packages).find(([k]) => k.includes(`/packages/${modKey.slice(4)}/src/index.ts`))
    : Object.entries(modules).find(([k]) => k.includes(`/arena-gathered/${modKey}/src/index.ts`));
  if (!entry) { info.textContent = `no module for mod=${modKey}; have: ${Object.keys(modules).map((k) => k.split('arena-gathered/')[1]?.replace('/src/index.ts', '')).join(', ')}`; return; }
  const mod = await entry[1]();
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
  // ground=-2.6 drops the ground below foundation skirts (their tops sit at y=0)
  ground.position.y = Number(q.get('ground') ?? 0);
  ground.receiveShadow = true;
  scene.add(ground);
  const tris: string[] = [];
  fns.forEach((name, col) => {
    type Built = { group?: THREE.Object3D; body?: THREE.Object3D; wheel?: THREE.Object3D | null; hubs?: [number, number, number][] };
    const build = mod[name] as ((mm: unknown, o: unknown) => Built) | undefined;
    [1, 6].forEach((stage, row) => {
      if (!build) return;
      const built = build(m, { stage });
      // a rover (rovergear) is a body plus one wheel cloned at each hub; stand it on its lowest point
      let g: THREE.Object3D;
      if (built.group) g = built.group;
      else {
        g = new THREE.Group();
        const rig = new THREE.Group(); rig.add(built.body!);
        for (const [x, y, z] of built.hubs ?? []) { if (!built.wheel) break; const w = built.wheel.clone(); w.position.set(x, y, z); rig.add(w); }
        rig.position.y = -new THREE.Box3().setFromObject(rig).min.y;
        g.add(rig);
      }
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
  // view=back looks from -z (the far side: the top of a roof that rises toward +z)
  const front = q.get('view') === 'front', back = q.get('view') === 'back' ? -1 : 1;
  const fit = Math.max(size.x / camera.aspect, size.z, size.y) / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.15;
  camera.position.set(centre.x + (front ? 0 : fit * 0.35), centre.y + fit * (front ? 0.25 : 0.6), centre.z + back * fit * 0.9);
  camera.lookAt(centre);
  renderer.render(scene, camera);
  info.textContent = `${modKey} · ${tris.join(' · ')}`;
  (window as unknown as { __galleryReady: boolean }).__galleryReady = true;
}
// ?rovers=1 (TASK-15): the rovers as the game builds them (createGenRover). Columns: the one-piece scout, the assembled
// scout, the crawler and the hauler. Row 1 is stage 1 (low), row 2 is stage 6 (high), each on the same sandy ground.
async function rovers(): Promise<void> {
  const { loadGen } = await import('../assets/gen');
  const { createGenRover, genLevelForStage } = await import('../assets/gen-props');
  const ids = ['scout-body', 'scout-chassis', 'scout-shell', 'headlight', 'vehicle-seat', 'scout-wheel',
    'crawler-body', 'crawler-arm', 'hauler-body', 'hauler-wheel'];
  await Promise.all(ids.flatMap((id) => (['low', 'high'] as const).map((l) => loadGen(id, l).catch(() => null))));
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
  ground.position.y = Number(q.get('ground') ?? 0);
  ground.receiveShadow = true;
  scene.add(ground);
  const cols: { label: string; kind: 'scout' | 'crawler' | 'hauler'; modular?: boolean }[] = [
    { label: 'scout one-piece', kind: 'scout', modular: false },
    { label: 'scout assembled', kind: 'scout', modular: true },
    { label: 'crawler', kind: 'crawler' },
    { label: 'hauler', kind: 'hauler' },
  ];
  const spacing = Number(q.get('spacing') ?? 9);
  const tris: string[] = [];
  // only=<column> draws one column (for the side view: stage 1 and stage 6 side by side along z)
  const only = q.get('only');
  cols.forEach((c, col) => {
    if (only !== null && Number(only) !== col) return;
    [1, 6].forEach((stage, row) => {
      const level = genLevelForStage(stage);
      const rover = createGenRover(c.kind, level, stage, undefined, { modular: c.modular ?? false });
      const rig = new THREE.Group();
      rig.add(rover.body);
      if (rover.wheel) {
        for (const h of rover.hubs) {
          const pivot = new THREE.Group();
          pivot.position.set(h[0], h[1], h[2]);
          const w = rover.wheel.clone();
          if (h[0] < 0) w.rotation.y = Math.PI;
          pivot.add(w);
          rig.add(pivot);
        }
      }
      rig.position.y = -new THREE.Box3().setFromObject(rig).min.y;
      const g = new THREE.Group();
      g.add(rig);
      g.position.set(col * spacing, 0, -row * spacing);
      g.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
      scene.add(g);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 0.15), new THREE.MeshStandardMaterial({ color: '#ff3b6b' }));
      post.position.set(col * spacing - 2.6, 1.5, -row * spacing + 2.6);
      scene.add(post);
      let t = 0; g.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { const geo = mesh.geometry; t += (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3; } });
      tris.push(`${c.label} s${stage}: ${Math.round(t)}`);
    });
  });
  const all = new THREE.Box3();
  scene.children.forEach((o) => { if (o !== ground && !(o instanceof THREE.Light)) all.expandByObject(o); });
  const centre = all.getCenter(new THREE.Vector3()), size = all.getSize(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 800);
  const front = q.get('view') === 'front', top = q.get('view') === 'top', back = q.get('view') === 'back' ? -1 : 1;
  const fit = Math.max(size.x / camera.aspect, size.z, size.y) / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.15 * Number(q.get('zoom') ?? 1);
  const side = q.get('view') === 'side';
  if (q.get('view') === 'cab') {
    // the driver's eye in the cab of the rover at the column and row (row 0 = stage 1): looking forward (+z)
    const col = Number(only ?? 1), x = col * spacing, z = -Number(q.get('row') ?? 0) * spacing;
    camera.position.set(x, 1.65, z - 0.25);
    camera.lookAt(x, 1.35, z + 6);
    camera.fov = 60; camera.updateProjectionMatrix();
  } else {
    // row=<n> aims at one rover of the column (its centre), otherwise at the whole group
    const tgt = q.has('row') && only !== null ? new THREE.Vector3(Number(only) * spacing, 0.6, -Number(q.get('row')) * spacing) : centre;
    if (top) camera.position.set(tgt.x, tgt.y + fit * 1.6, tgt.z + 0.01);
    else if (side) camera.position.set(tgt.x + fit * 1.1, tgt.y + fit * 0.12, tgt.z);
    else camera.position.set(tgt.x + (front ? 0 : fit * 0.35), tgt.y + fit * (front ? 0.25 : 0.6), tgt.z + back * fit * 0.9);
    camera.lookAt(tgt);
  }
  renderer.render(scene, camera);
  info.textContent = `rovers · ${tris.join(' · ')}`;
  (window as unknown as { __galleryReady: boolean }).__galleryReady = true;
}
main().catch((e: unknown) => { info.textContent = `error: ${String(e)}`; });
