// Dev-only: Astro playing any of its clips side by side, for review.
//   /astro.html?clips=breathing-idle,walking,running[&level=mid][&t=1.0]
import * as THREE from 'three';
import { loadScientistAnimations } from '../avatar/scientist/anims-loader';
import { adaptClipsForAstro, createScientistInstance } from '../avatar/scientist/scientist-model';
import type { AstroLevel } from '../avatar/astro/astro-model';

const info = document.getElementById('info')!;
async function main(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const names = (q.get('clips') ?? 'breathing-idle,walking,running').split(',').filter(Boolean);
  const level = (q.get('level') ?? 'mid') as AstroLevel, t = Number(q.get('t') ?? 1.0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#8fa3b8');
  scene.add(new THREE.HemisphereLight('#e6eef7', '#5d5346', 1.1));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6); sun.position.set(-3, 6, 4); sun.castShadow = true; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#b9a27f', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const set = await loadScientistAnimations();
  const spacing = 1.5, x0 = -((names.length - 1) * spacing) / 2;
  for (const [i, name] of names.entries()) {
    const { group } = await createScientistInstance('#f59e0b', level);
    group.position.set(x0 + i * spacing, 0, 0); group.rotation.y = 0.5; scene.add(group);
    const clip = adaptClipsForAstro(group, set).get(name);
    if (clip) { const m = new THREE.AnimationMixer(group); m.clipAction(clip).play(); m.update(Math.min(t, clip.duration * 0.999)); }
  }
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0.4, 1.5, 3.2 + names.length * 1.1); camera.lookAt(0, 0.9, 0);
  renderer.render(scene, camera);
  info.textContent = `Astro ${level} · ${names.join(' · ')} at t=${t}`;
  (window as unknown as { __astroReady: boolean }).__astroReady = true;
}
main().catch((e: unknown) => { info.textContent = `error: ${String(e)}`; });
