/**
 * The Ball Garage showroom, Hoop-Pod edition (docs/HOOP_POD.md §Garage).
 *
 * Drop-in for the sphere showroom: same props, same DOM (`.garage-ball-3d`, `.garage-cradle`,
 * canvas / flat fallback), so BallCustomizer and garage CSS are untouched. What is shown is the race
 * renderer itself — a one-slot HoopPodFleet — so what is painted here is exactly what rolls.
 *
 *  - The design's bake (sphere-decal-baker, equirect) is sampled on the six hoop crowns; the painted
 *    latitude is tiled across them, so nothing painted is lost in the sight slot.
 *  - Drag sideways turns the pod; drag up/down rolls the hoops while the inner ball and caps stay
 *    level (IF-GYRO). Idle, it rolls slowly on its axle unless the player prefers reduced motion.
 *  - A still click on a hoop reports the exact bake (u, v) under the pointer — the texel the baker
 *    stamps at — after undoing the hoop roll. Caps and the porthole report `onCap` (or `onPorthole`).
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BakeResult, RgbaImage } from '../../game/meta/sphere-decal-baker';
import { HoopPodFleet } from '../../game/pod/pod-fleet';
import { authoredFromLocal, bakeUvForPoint, podGeometry } from '../../game/pod/pod-geometry';
import { accentFromBake, liveryFromBake } from '../../game/pod/pod-design';
import type { PodLivery } from '../../game/pod/pod-livery';
import type { CapFinish } from './BallShowroom';

interface Props {
  baked: BakeResult;
  capFinish: CapFinish;
  /** A click on a painted hoop, at bake texture (u, v). */
  onSurface: (u: number, v: number) => void;
  /** A click on a cap (nothing can be painted there). */
  onCap: () => void;
  /** A click on the porthole / inner ball. Defaults to `onCap`. */
  onPorthole?: () => void;
  label: string;
}

interface Stage {
  fleet: HoopPodFleet;
  proxy: THREE.Mesh;
  pending: PodLivery | null;
}

const BASE_YAW = Math.PI; // the pod faces −Z; turn the porthole toward the camera

function paint(canvas: HTMLCanvasElement, img: RgbaImage) {
  if (canvas.width !== img.width || canvas.height !== img.height) { canvas.width = img.width; canvas.height = img.height; }
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
}

export default function PodShowroom({ baked, capFinish, onSurface, onCap, onPorthole, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cradleRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const handlers = useRef({ onSurface, onCap, onPorthole });
  handlers.current = { onSurface, onCap, onPorthole };
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.22;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
    camera.position.set(0, 0.6, 6.1);
    camera.lookAt(0, 0, 0);
    const key = new THREE.DirectionalLight(0xffe0b0, 1.8); key.position.set(-3, 3.5, 3);
    const rim = new THREE.DirectionalLight(0xff8a3d, 1.8); rim.position.set(3.2, 1.2, -2.5);
    scene.add(key, rim, new THREE.HemisphereLight(0x9fb09a, 0x1a120a, 0.45));

    const fleet = new HoopPodFleet(scene, {
      capacity: 1, radius: 1, lods: ['hero', 'hero', 'hero'], frustumCull: false,
      bakeLayers: 1, bakeWidth: 1024, playerDesign: false, listen: false,
    });
    fleet.setCount(1);
    // Invisible raycast twin of the hero mesh. Hoops are surfaces of revolution about the axle, so
    // the un-rolled twin occupies exactly the space of the rolled hoops.
    const hero = podGeometry('hero');
    const proxy = new THREE.Mesh(hero.geometry, new THREE.MeshBasicMaterial({ visible: false }));
    proxy.scale.setScalar(1 / hero.rideHeight);
    stageRef.current = { fleet, proxy, pending: null };

    const placeCradle = (width: number, height: number) => {
      const cradle = cradleRef.current;
      if (!cradle) return;
      const bottom = new THREE.Vector3(0, -1, 0).project(camera);
      const side = new THREE.Vector3(1, 0, 0).project(camera);
      const centre = new THREE.Vector3(0, 0, 0).project(camera);
      const px = (n: number) => ((n + 1) / 2) * width;
      const py = (n: number) => ((1 - n) / 2) * height;
      const radius = Math.max(8, Math.abs(px(side.x) - px(centre.x)));
      cradle.style.width = `${radius * 1.9}px`;
      cradle.style.opacity = '1';
      cradle.style.left = `${px(centre.x)}px`;
      cradle.style.top = `${py(bottom.y)}px`;
    };
    const resize = () => {
      const box = canvas.parentElement?.getBoundingClientRect();
      if (!box?.width) return;
      renderer.setSize(box.width, box.height, false);
      camera.aspect = box.width / Math.max(1, box.height);
      camera.updateProjectionMatrix();
      placeCradle(box.width, box.height);
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (canvas.parentElement) observer?.observe(canvas.parentElement);

    let turn = -0.55; // three-quarter view: porthole and one cap in sight
    let rollPhase = 0;
    const yawQuat = new THREE.Quaternion();
    const origin = { x: 0, y: 0, z: 0 };
    const racer = { id: -1 };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let down: { x: number; y: number; moved: boolean } | null = null;
    let lastTouch = -Infinity;
    const raycaster = new THREE.Raycaster();

    const pose = () => {
      yawQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, BASE_YAW + turn);
      proxy.quaternion.copy(yawQuat);
      proxy.updateMatrixWorld(true);
    };
    const pick = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      pose();
      return raycaster.intersectObject(proxy, false)[0];
    };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); lastTouch = performance.now(); };
    const onMove = (e: PointerEvent) => {
      if (!down) { canvas.style.cursor = pick(e) ? 'crosshair' : 'grab'; return; }
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 5) return;
      down.moved = true; canvas.style.cursor = 'grabbing';
      turn += (e.movementX || 0) * 0.012;
      rollPhase = (rollPhase + (e.movementY || 0) * 0.012) % (Math.PI * 2);
      lastTouch = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      const was = down; down = null; lastTouch = performance.now();
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = 'grab';
      if (!was || was.moved) return;
      const h = pick(e);
      if (!h || !h.face) return;
      const part = (hero.geometry.getAttribute('aPart') as THREE.BufferAttribute).getX(h.face.a);
      const local = proxy.worldToLocal(h.point.clone());
      if (part > 0.5) {
        // Undo the shader's hoop roll (rotX(−rollPhase)) to find the painted texel under the pointer.
        const c = Math.cos(rollPhase), s = Math.sin(rollPhase);
        const rest = new THREE.Vector3(local.x, c * local.y - s * local.z, s * local.y + c * local.z);
        const a = authoredFromLocal(rest);
        const { u, v } = bakeUvForPoint(a.x, a.y, a.z);
        handlers.current.onSurface(u, v);
      } else if (Math.abs(local.x) > 0.85) {
        handlers.current.onCap();
      } else {
        (handlers.current.onPorthole ?? handlers.current.onCap)();
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!down && !reduced?.matches && now - lastTouch > 2500) rollPhase = (rollPhase + dt * 0.35) % (Math.PI * 2);
      pose();
      fleet.setRacer(0, racer, origin, yawQuat, rollPhase, true, 0, dt);
      const stage = stageRef.current;
      if (stage?.pending) { fleet.setLivery(0, stage.pending, 0); stage.pending = null; }
      fleet.commit(camera, dt, reduced?.matches ?? false, canvas.clientHeight);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      fleet.dispose();
      (proxy.material as THREE.Material).dispose(); // the geometry is the shared LOD cache: keep it
      scene.environment?.dispose(); pmrem.dispose(); room.dispose?.();
      renderer.dispose();
      stageRef.current = null;
    };
  }, []);

  // New bake or cap finish → upload the bake, re-derive the unbaked parts' livery.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      if (failed && typeof document !== 'undefined') {
        const c = document.createElement('canvas'); paint(c, baked.albedo); setFallback(c.toDataURL());
      }
      return;
    }
    stage.fleet.setBake(0, baked);
    stage.pending = liveryFromBake(baked.albedo, accentFromBake(baked.albedo), capFinish);
  }, [baked, capFinish, failed]);

  return (
    <div className="garage-ball-3d" role="img" aria-label={label}>
      <div className={`garage-cradle${failed ? ' flat' : ''}`} ref={cradleRef} aria-hidden="true" />
      {failed
        ? <div className="garage-ball-fallback" style={{ backgroundImage: fallback ? `url(${fallback})` : undefined }} />
        : <canvas ref={canvasRef} />}
    </div>
  );
}
