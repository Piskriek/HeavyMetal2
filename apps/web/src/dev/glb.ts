// Dev-only: review generated GLBs side by side (RUN.world 3D tests and the like).
//   /glb.html?src=/src/dev/tmp/a.glb,/src/dev/tmp/b.glb[&h=1.6,0.8][&yaw=0.6][&zoom=2][&wire=1][&spin=1]
// Each model is scaled to its target height (metres) and stood on the ground; the bar lists triangles,
// meshes, materials and texture sizes, the numbers a budget review needs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const info = document.getElementById('info')!;

interface Stats { tris: number; meshes: number; materials: number; textures: string[] }
function statsOf(root: THREE.Object3D): Stats {
  const mats = new Set<THREE.Material>(), tex = new Map<string, string>();
  let tris = 0, meshes = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes['position']!.count) / 3;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      mats.add(mat);
      for (const v of Object.values(mat)) {
        const t = v as THREE.Texture | null;
        if (t && (t as THREE.Texture).isTexture) {
          const img = t.image as { width?: number; height?: number } | undefined;
          tex.set(t.uuid, `${img?.width ?? '?'}²`);
        }
      }
    }
  });
  return { tris: Math.round(tris), meshes, materials: mats.size, textures: [...tex.values()] };
}

async function main(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const srcs = (q.get('src') ?? '').split(',').filter(Boolean);
  const heights = (q.get('h') ?? '').split(',').map(Number);
  const yaw = Number(q.get('yaw') ?? 0.6), wire = q.get('wire') === '1', spin = q.get('spin') === '1';

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#8fa3b8');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight('#e6eef7', '#5d5346', 0.6));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.2); sun.position.set(-3, 6, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#9c9890', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const draco = new DRACOLoader(); draco.setDecoderPath('/src/dev/tmp/draco/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder);
  const models: THREE.Object3D[] = [], lines: string[] = [];
  let x = 0;
  for (const [i, src] of srcs.entries()) {
    const gltf = await loader.loadAsync(src);
    const root = gltf.scene;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      if (wire) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) (mat as THREE.MeshStandardMaterial).wireframe = true;
    });
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    const h = heights[i] && heights[i]! > 0 ? heights[i]! : 1.6, s = h / size.y;
    const pivot = new THREE.Group(); pivot.add(root);
    root.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    pivot.scale.setScalar(s); pivot.rotation.y = yaw;
    const w = Math.max(size.x, size.z) * s;
    pivot.position.x = x + w / 2; x += w + 0.6;
    scene.add(pivot); models.push(pivot);
    const st = statsOf(root);
    lines.push(`${src.split('/').pop()}: ${st.tris.toLocaleString('en')} tris · ${st.meshes} mesh · ${st.materials} mat · tex ${st.textures.join(' ') || 'none'}`);
  }
  for (const m of models) m.position.x -= x / 2 - 0.3;

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);
  const span = Math.max(2, x), top = Math.max(...heights.filter((h) => h > 0), 1.6);
  const zoom = Number(q.get('zoom') ?? 1);
  camera.position.set(0, top * 0.75, (span * 1.35 + top) / zoom);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, top * 0.45, 0); controls.update();
  info.textContent = lines.join('  |  ');
  const loop = (): void => {
    if (spin) for (const m of models) m.rotation.y += 0.006;
    controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop);
  };
  loop();
  (window as unknown as { __glbReady: boolean }).__glbReady = true;
}
main().catch((e: unknown) => { info.textContent = `error: ${String(e)}`; });
