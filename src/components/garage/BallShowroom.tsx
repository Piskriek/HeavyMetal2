/**
 * The Ball Garage's showroom: the design on a lit sphere with the race ball's geometry (the
 * texture's poles sit under the brass caps on ±X, CAP_THETA wide), so what is painted here is what
 * rolls on the track. Dragging sideways turns the ball to show a cap; dragging up and down rolls it.
 * A click that does not drag reports the (u, v) under the pointer, the exact texel the baker stamps
 * at. Left alone, it rolls slowly on its axle, unless the player prefers reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAP_RADIUS_SCALE, CAP_THETA } from '../../game/gyro-ball';
import type { CustomBallConfig } from '../../game/meta/interfaces';
import type { BakeResult, RgbaImage } from '../../game/meta/sphere-decal-baker';

export type CapFinish = CustomBallConfig['capFinish'];

export const CAP_FINISHES: Readonly<Record<CapFinish, { name: string; color: number; metalness: number; roughness: number; swatch: string }>> = {
  brass: { name: 'Brass', color: 0xc08a2e, metalness: 0.9, roughness: 0.32, swatch: 'radial-gradient(circle at 35% 30%, #fff1b8, #d9a441 35%, #8a5c17 70%, #3d270a)' },
  gunmetal: { name: 'Gunmetal', color: 0x5a6068, metalness: 0.85, roughness: 0.42, swatch: 'radial-gradient(circle at 35% 30%, #d8dde2, #6d747c 35%, #353a40 70%, #15181b)' },
  copper: { name: 'Copper', color: 0xb8643a, metalness: 0.9, roughness: 0.35, swatch: 'radial-gradient(circle at 35% 30%, #ffd2b0, #c9744a 35%, #7a3a1c 70%, #321507)' },
  chrome: { name: 'Chrome', color: 0xe4e9ee, metalness: 1, roughness: 0.12, swatch: 'radial-gradient(circle at 35% 30%, #ffffff, #c9d1d8 30%, #6c7680 62%, #222830)' },
};

interface Props {
  baked: BakeResult;
  capFinish: CapFinish;
  /** A click on the painted shell, at texture (u, v). */
  onSurface: (u: number, v: number) => void;
  /** A click on a cap (nothing can be painted there). */
  onCap: () => void;
  label: string;
}

interface Scene {
  renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; scene: THREE.Scene;
  turn: THREE.Group; roll: THREE.Group; shell: THREE.Mesh; caps: THREE.Mesh;
  shellMat: THREE.MeshStandardMaterial; capMat: THREE.MeshStandardMaterial;
  albedo: THREE.CanvasTexture; emissive: THREE.CanvasTexture; albedoCanvas: HTMLCanvasElement; emissiveCanvas: HTMLCanvasElement;
}

function paint(canvas: HTMLCanvasElement, img: RgbaImage) {
  if (canvas.width !== img.width || canvas.height !== img.height) { canvas.width = img.width; canvas.height = img.height; }
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
}

export default function BallShowroom({ baked, capFinish, onSurface, onCap, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const handlers = useRef({ onSurface, onCap });
  handlers.current = { onSurface, onCap };
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState('');

  // Build the scene once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.22;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
    camera.position.set(0, 0.6, 6.1);
    camera.lookAt(0, 0, 0);
    const key = new THREE.DirectionalLight(0xffe0b0, 1.7); key.position.set(-3, 3.5, 3);
    const rim = new THREE.DirectionalLight(0xff8a3d, 1.8); rim.position.set(3.2, 1.2, -2.5);
    scene.add(key, rim, new THREE.HemisphereLight(0x9fb09a, 0x1a120a, 0.35));

    const albedoCanvas = document.createElement('canvas');
    const emissiveCanvas = document.createElement('canvas');
    const albedo = new THREE.CanvasTexture(albedoCanvas);
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const emissive = new THREE.CanvasTexture(emissiveCanvas);
    emissive.colorSpace = THREE.SRGBColorSpace;
    emissive.wrapS = THREE.RepeatWrapping;

    const shellGeo = new THREE.SphereGeometry(1, 96, 64);
    shellGeo.rotateZ(-Math.PI / 2); // texture pole (+Y) → +X, under the caps, like the race ball
    const shellMat = new THREE.MeshStandardMaterial({ map: albedo, metalness: 0.25, roughness: 0.62, emissive: 0x000000, emissiveMap: emissive });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    const left = new THREE.SphereGeometry(CAP_RADIUS_SCALE, 48, 16, 0, Math.PI * 2, 0, CAP_THETA); left.rotateZ(Math.PI / 2);
    const right = new THREE.SphereGeometry(CAP_RADIUS_SCALE, 48, 16, 0, Math.PI * 2, 0, CAP_THETA); right.rotateZ(-Math.PI / 2);
    const capGeo = mergeGeometries([left, right]) ?? left; // one raycast target, one material
    if (capGeo !== left) left.dispose();
    right.dispose();
    const capMat = new THREE.MeshStandardMaterial({ color: CAP_FINISHES.brass.color, metalness: 0.9, roughness: 0.32 });
    const caps = new THREE.Mesh(capGeo, capMat);
    const roll = new THREE.Group(); roll.add(shell, caps);
    const turn = new THREE.Group(); turn.add(roll);
    turn.rotation.y = -0.55; // three-quarter view: one cap in sight
    scene.add(turn);
    sceneRef.current = { renderer, camera, scene, turn, roll, shell, caps, shellMat, capMat, albedo, emissive, albedoCanvas, emissiveCanvas };

    const resize = () => {
      const box = canvas.parentElement?.getBoundingClientRect();
      if (!box?.width) return;
      renderer.setSize(box.width, box.height, false);
      camera.aspect = box.width / Math.max(1, box.height);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (canvas.parentElement) observer?.observe(canvas.parentElement);

    // Pointer: drag spins, a still click paints.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let down: { x: number; y: number; id: number; moved: boolean } | null = null;
    let lastTouch = -Infinity;
    const raycaster = new THREE.Raycaster();
    const hit = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      return raycaster.intersectObjects([caps, shell], false)[0];
    };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }; canvas.setPointerCapture(e.pointerId); lastTouch = performance.now(); };
    const onMove = (e: PointerEvent) => {
      if (!down) { canvas.style.cursor = hit(e) ? 'crosshair' : 'grab'; return; }
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 5) return;
      down.moved = true; canvas.style.cursor = 'grabbing';
      turn.rotation.y += (e.movementX || 0) * 0.012;
      roll.rotation.x += (e.movementY || 0) * 0.012;
      lastTouch = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      const was = down; down = null; lastTouch = performance.now();
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = 'grab';
      if (!was || was.moved) return;
      const h = hit(e);
      if (!h) return;
      if (h.object === caps) handlers.current.onCap();
      else if (h.uv) handlers.current.onSurface(h.uv.x, h.uv.y);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!down && !reduced?.matches && now - lastTouch > 2500) roll.rotation.x += dt * 0.35;
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
      shellGeo.dispose(); capGeo.dispose(); shellMat.dispose(); capMat.dispose(); albedo.dispose(); emissive.dispose();
      scene.environment?.dispose(); pmrem.dispose(); room.dispose?.();
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  // New bake → new textures.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) {
      if (failed && typeof document !== 'undefined') {
        const c = document.createElement('canvas'); paint(c, baked.albedo); setFallback(c.toDataURL());
      }
      return;
    }
    paint(s.albedoCanvas, baked.albedo);
    s.albedo.needsUpdate = true;
    if (baked.emissive) {
      paint(s.emissiveCanvas, baked.emissive);
      s.emissive.needsUpdate = true;
      s.shellMat.emissive.setHex(0xffffff);
      s.shellMat.emissiveIntensity = 1.2;
    } else {
      s.shellMat.emissive.setHex(0x000000);
    }
  }, [baked, failed]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const f = CAP_FINISHES[capFinish];
    s.capMat.color.setHex(f.color); s.capMat.metalness = f.metalness; s.capMat.roughness = f.roughness;
  }, [capFinish]);

  return (
    <div className="garage-ball-3d" role="img" aria-label={label}>
      {failed
        ? <div className="garage-ball-fallback" style={{ backgroundImage: fallback ? `url(${fallback})` : undefined }} />
        : <canvas ref={canvasRef} />}
    </div>
  );
}
