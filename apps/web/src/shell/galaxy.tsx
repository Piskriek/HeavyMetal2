import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * The galaxy: a spiral of stars with planets (each planet is an activity). Used as the backdrop of the main menu (slow drift), for the dive into
 * your own planet, and as the multiplayer hub (orbit, hover, pick). Pure three.js, deterministic from a seed, no assets.
 */
export interface PlanetDef { readonly id: string; readonly name: string; readonly hue: number; readonly size: number; readonly ring: boolean; readonly hosting?: boolean }
export interface GalaxyHandle {
  /** Fly the camera in to a planet; resolves when it fills the view. */
  diveTo(id: string, ms: number): Promise<void>;
}

const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Where each planet sits: spiral arms, stable for a given list order and seed. */
export function planetPositions(planets: readonly PlanetDef[], seed = 3): Map<string, THREE.Vector3> {
  const rnd = mulberry(seed);
  const out = new Map<string, THREE.Vector3>();
  planets.forEach((p, i) => {
    const r = i === 0 ? 38 : 52 + i * 14 + rnd() * 10;
    const a = i * 2.399963 + rnd() * 0.4; // golden angle keeps neighbours apart
    out.set(p.id, new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.5) * 6, Math.sin(a) * r));
  });
  return out;
}

export const GalaxyCanvas = forwardRef<GalaxyHandle, {
  readonly planets: readonly PlanetDef[];
  readonly mode: 'backdrop' | 'hub';
  readonly focusId?: string;
  readonly highlightId?: string;
  readonly onPick?: (id: string | null) => void;
  readonly reducedMotion?: boolean;
}>(function GalaxyCanvas(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ dive: (id: string, ms: number) => Promise<void> } | null>(null);
  const live = useRef(props);
  live.current = props;
  useImperativeHandle(ref, () => ({ diveTo: (id, ms) => (api.current ? api.current.dive(id, ms) : Promise.resolve()) }), []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x06070b, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
    const glow = glowTexture();

    // stars: a four-arm spiral plus a faint far shell
    const rnd = mulberry(11);
    const N = 9000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const core = new THREE.Color('#ffd9a0'), mid = new THREE.Color('#e98a63'), edge = new THREE.Color('#7ea4d6');
    for (let i = 0; i < N; i++) {
      const arm = i % 4, r = Math.pow(rnd(), 0.55) * 230;
      const a = (arm * Math.PI) / 2 + r * 0.028 + (rnd() - 0.5) * (0.5 + r * 0.004);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (rnd() - 0.5) * (14 - r * 0.04); pos[i * 3 + 2] = Math.sin(a) * r;
      const c = r < 60 ? core.clone().lerp(mid, r / 60) : mid.clone().lerp(edge, Math.min(1, (r - 60) / 170));
      c.multiplyScalar(0.55 + rnd() * 0.6);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.5, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(stars);
    const farPos = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(1500); farPos.set([v.x, v.y, v.z], i * 3); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(farPos, 3));
    scene.add(new THREE.Points(fg, new THREE.PointsMaterial({ size: 3, color: 0xcfd8e8, transparent: true, opacity: 0.7, depthWrite: false })));
    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc58a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    coreGlow.scale.set(120, 120, 1); scene.add(coreGlow);

    scene.add(new THREE.AmbientLight(0x8a93a8, 0.55));
    const sun = new THREE.PointLight(0xffe2b8, 5200, 0, 1.6); sun.position.set(0, 14, 0); scene.add(sun);

    // planets: low-poly spheres with vertex colour bands, a soft atmosphere, optional ring
    const meshes = new Map<string, THREE.Group>();
    const positions = planetPositions(live.current.planets);
    const planetGroup = new THREE.Group(); scene.add(planetGroup);
    const makePlanet = (p: PlanetDef): THREE.Group => {
      const g = new THREE.Group();
      const radius = 4 * p.size;
      const geo = new THREE.IcosahedronGeometry(radius, 2).toNonIndexed();
      const rr = mulberry(Math.floor(p.hue * 1000) + 5);
      const cols: number[] = [];
      const base = new THREE.Color().setHSL(p.hue, 0.45, 0.42), land = new THREE.Color().setHSL((p.hue + 0.28) % 1, 0.4, 0.45), snow = new THREE.Color('#f1efe6');
      const p3 = geo.getAttribute('position');
      for (let i = 0; i < p3.count; i += 3) {
        const cy = (p3.getY(i) + p3.getY(i + 1) + p3.getY(i + 2)) / 3 / radius;
        const n = rr();
        const c = Math.abs(cy) > 0.86 ? snow : n > 0.55 + Math.abs(cy) * 0.25 ? land : base;
        const cc = c.clone().multiplyScalar(0.9 + rr() * 0.2);
        for (let k = 0; k < 3; k++) cols.push(cc.r, cc.g, cc.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 }));
      mesh.name = p.id; g.add(mesh);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color().setHSL(p.hue, 0.6, 0.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(radius * 4); g.add(halo);
      if (p.ring) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.5, radius * 1.9, 64), new THREE.MeshBasicMaterial({ color: 0xd5a24a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
        ring.rotation.x = Math.PI / 2.4; g.add(ring);
      }
      return g;
    };
    const build = (): void => {
      for (const g of meshes.values()) planetGroup.remove(g);
      meshes.clear();
      for (const p of live.current.planets) { const g = makePlanet(p); g.position.copy(positions.get(p.id) ?? new THREE.Vector3()); planetGroup.add(g); meshes.set(p.id, g); }
    };
    build();
    // the highlight: a thin ring that follows the chosen planet
    const mark = new THREE.Mesh(new THREE.RingGeometry(1, 1.04, 96), new THREE.MeshBasicMaterial({ color: 0xc56443, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }));
    mark.renderOrder = 10; scene.add(mark);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    let diving = false;
    const home = new THREE.Vector3(0, 70, 190);
    camera.position.copy(home);
    controls.target.set(0, 0, 0);
    const syncControls = (): void => {
      const hub = live.current.mode === 'hub';
      controls.enabled = hub && !diving; controls.minDistance = 14; controls.maxDistance = 420; controls.enablePan = hub;
      controls.autoRotate = false;
    };
    syncControls();

    const size = (): void => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    size();
    const ro = new ResizeObserver(size); ro.observe(el);

    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
    let hover: string | null = null;
    const pickAt = (e: PointerEvent): string | null => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects([...meshes.values()].map((g) => g.children[0]!), false)[0];
      return hit ? hit.object.name : null;
    };
    const onMove = (e: PointerEvent): void => { if (live.current.mode !== 'hub') return; hover = pickAt(e); renderer.domElement.style.cursor = hover ? 'pointer' : 'grab'; };
    const onClick = (e: PointerEvent): void => { if (live.current.mode !== 'hub') return; live.current.onPick?.(pickAt(e)); };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('click', onClick as never);

    api.current = {
      dive: (id, ms) => new Promise<void>((resolve) => {
        const target = positions.get(id) ?? new THREE.Vector3();
        const radius = 4 * (live.current.planets.find((p) => p.id === id)?.size ?? 1);
        const from = camera.position.clone(), fromT = controls.target.clone();
        const dir = from.clone().sub(target).normalize();
        const to = target.clone().add(dir.multiplyScalar(radius * 1.55));
        diving = true; controls.enabled = false;
        const t0 = performance.now();
        const step = (now: number): void => {
          const k = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms), e = ease(k);
          // fly on a log-scale so the last stretch (the planet filling the view) is the slowest
          const ke = 1 - Math.pow(1 - e, 1.6);
          camera.position.lerpVectors(from, to, ke); controls.target.lerpVectors(fromT, target, e);
          camera.lookAt(controls.target);
          if (k < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      }),
    };

    let raf = 0, last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const L = live.current;
      syncControls();
      if (L.mode === 'backdrop' && !diving && !L.reducedMotion) {
        // a slow drift around the galaxy so the menu is alive
        const a = now * 0.000045;
        camera.position.set(Math.sin(a) * 190, 70 + Math.sin(a * 1.7) * 8, Math.cos(a) * 190);
        camera.lookAt(0, 0, 0);
      }
      if (L.mode === 'hub' && L.focusId && !diving && !(controls as unknown as { _focused?: string })._focused) {
        const p = positions.get(L.focusId); if (p) { controls.target.copy(p); camera.position.set(p.x + 30, p.y + 22, p.z + 46); (controls as unknown as { _focused?: string })._focused = L.focusId; }
      }
      stars.rotation.y += dt * 0.004;
      for (const [id, g] of meshes) { g.children[0]!.rotation.y += dt * (id === L.highlightId ? 0.4 : 0.12); }
      const hl = L.highlightId ? meshes.get(L.highlightId) : undefined;
      mark.visible = !!hl && L.mode === 'hub';
      if (hl) {
        const radius = 4 * (L.planets.find((p) => p.id === L.highlightId)?.size ?? 1);
        mark.position.copy(hl.position); mark.scale.setScalar(radius * 2.4 + Math.sin(now * 0.003) * radius * 0.08); mark.quaternion.copy(camera.quaternion);
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('click', onClick as never);
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.(); });
      glow.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [props.planets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className="galaxy" style={{ position: 'absolute', inset: 0, background: '#06070b' }} />;
});
