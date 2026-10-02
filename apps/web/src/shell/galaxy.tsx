import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * The galaxy, drawn like a printed star chart: a white field with black stars in four spiral arms, no glow. Each activity is a planet in full
 * colour that floats above the chart like a map pin, joined by a thin line to its star below, and the star sits in a small square box. As
 * the pointer comes near a planet it grows, and a card shows what is hosted there; a click picks it. Used as the multiplayer hub and for the
 * dive into a planet. Pure three.js, deterministic from a seed, no assets.
 */
export interface PlanetDef {
  readonly id: string; readonly name: string; readonly hue: number; readonly size: number; readonly ring: boolean; readonly hosting?: boolean;
  /** What is played there (shown on the hover card). */
  readonly doc?: string;
  readonly players?: number;
}
export interface GalaxyHandle {
  /** Fly the camera in to a planet; resolves when it fills the view. */
  diveTo(id: string, ms: number): Promise<void>;
}

const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const PAPER = 0xf6f5f0;
const INK = '#22241f';
/** Every planet is drawn at the same size: big enough to read as a marker. */
const PLANET_R = 4.2;
/** How high a planet floats above its star. */
const LIFT = 20;

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Where each planet's star sits on the chart: spiral arms, stable for a given list order and seed. */
export function planetPositions(planets: readonly PlanetDef[], seed = 3): Map<string, THREE.Vector3> {
  const rnd = mulberry(seed);
  const out = new Map<string, THREE.Vector3>();
  planets.forEach((p, i) => {
    const r = i === 0 ? 38 : 52 + i * 14 + rnd() * 10;
    const a = i * 2.399963 + rnd() * 0.4; // golden angle keeps neighbours apart
    out.set(p.id, new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  });
  return out;
}

interface Hover { readonly id: string; readonly x: number; readonly y: number }

export const GalaxyCanvas = forwardRef<GalaxyHandle, {
  readonly planets: readonly PlanetDef[];
  readonly mode: 'backdrop' | 'hub';
  readonly focusId?: string;
  readonly highlightId?: string;
  readonly onPick?: (id: string | null) => void;
  readonly reducedMotion?: boolean;
}>(function GalaxyCanvas(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const api = useRef<{ dive: (id: string, ms: number) => Promise<void> } | null>(null);
  const live = useRef(props);
  live.current = props;
  useImperativeHandle(ref, () => ({ diveTo: (id, ms) => (api.current ? api.current.dive(id, ms) : Promise.resolve()) }), []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(PAPER, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 4000);
    const dot = dotTexture();

    // the chart: black stars in four spiral arms, denser and darker towards the core
    const rnd = mulberry(11);
    const N = 12000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const bulge = i % 4 === 0; // a quarter of the stars make the dense core, the rest the arms
      const arm = i % 4, r = bulge ? Math.abs(rnd() + rnd() + rnd() - 1.5) * 34 : 12 + Math.pow(rnd(), 0.85) * 220;
      const a = bulge ? rnd() * Math.PI * 2 : (arm * Math.PI) / 2 + r * 0.028 + (rnd() - 0.5) * (0.45 + r * 0.003);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (rnd() - 0.5) * Math.max(1.5, 9 - r * 0.03); pos[i * 3 + 2] = Math.sin(a) * r;
      const ink = 0.05 + Math.min(0.6, r / 320) + rnd() * 0.15; // grey value: black at the core, paler at the rim
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ink;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.1, map: dot, alphaTest: 0.5, vertexColors: true, sizeAttenuation: true }));
    scene.add(stars);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b4a8, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-60, 120, 80); scene.add(sun);

    // planets: low-poly coloured spheres floating above their star, a line down to it, a small box round the star
    const markers = new Map<string, { group: THREE.Group; planet: THREE.Group; scale: number }>();
    const positions = planetPositions(live.current.planets);
    const chartGroup = new THREE.Group(); scene.add(chartGroup);
    const lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 });
    const boxMat = new THREE.LineBasicMaterial({ color: INK });
    const starMat = new THREE.MeshBasicMaterial({ color: INK });
    const boxGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1, -1, 0), new THREE.Vector3(1, -1, 0), new THREE.Vector3(1, 1, 0), new THREE.Vector3(-1, 1, 0)]);
    const boxes: THREE.LineLoop[] = [];
    const makeMarker = (p: PlanetDef, star: THREE.Vector3): { group: THREE.Group; planet: THREE.Group } => {
      const group = new THREE.Group();
      group.position.copy(star);
      const planet = new THREE.Group();
      planet.position.set(0, LIFT, 0);
      const geo = new THREE.IcosahedronGeometry(PLANET_R, 2).toNonIndexed();
      const rr = mulberry(Math.floor(p.hue * 1000) + 5);
      const cols: number[] = [];
      const base = new THREE.Color().setHSL(p.hue, 0.62, 0.55), land = new THREE.Color().setHSL((p.hue + 0.12) % 1, 0.58, 0.62), snow = new THREE.Color('#ffffff');
      const p3 = geo.getAttribute('position');
      for (let i = 0; i < p3.count; i += 3) {
        const cy = (p3.getY(i) + p3.getY(i + 1) + p3.getY(i + 2)) / 3 / PLANET_R;
        const n = rr();
        const c = Math.abs(cy) > 0.86 ? snow : n > 0.55 + Math.abs(cy) * 0.25 ? land : base;
        const cc = c.clone().multiplyScalar(0.92 + rr() * 0.16);
        for (let k = 0; k < 3; k++) cols.push(cc.r, cc.g, cc.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0 }));
      mesh.name = p.id;
      planet.add(mesh);
      if (p.ring) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(PLANET_R * 1.45, PLANET_R * 1.8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((p.hue + 0.5) % 1, 0.55, 0.5), side: THREE.DoubleSide }));
        ring.rotation.x = Math.PI / 2.4; planet.add(ring);
      }
      group.add(planet);
      // the pin: a line from the planet down to its star, the star itself, and a small box round the star
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, LIFT - PLANET_R, 0), new THREE.Vector3(0, 0, 0)]), lineMat));
      const starDot = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), starMat);
      group.add(starDot);
      const box = new THREE.LineLoop(boxGeo, boxMat);
      box.scale.setScalar(2.4);
      boxes.push(box);
      group.add(box);
      return { group, planet };
    };
    for (const p of live.current.planets) {
      const m = makeMarker(p, positions.get(p.id) ?? new THREE.Vector3());
      chartGroup.add(m.group);
      markers.set(p.id, { ...m, scale: 1 });
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.47;
    let diving = false;
    const home = new THREE.Vector3(0, 150, 230);
    camera.position.copy(home);
    controls.target.set(0, 8, 0);
    const syncControls = (): void => {
      const hub = live.current.mode === 'hub';
      controls.enabled = hub && !diving; controls.minDistance = 20; controls.maxDistance = 460; controls.enablePan = hub;
      controls.autoRotate = false;
    };
    syncControls();

    const size = (): void => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    size();
    const ro = new ResizeObserver(size); ro.observe(el);

    // nearness, in pixels on screen, between the pointer and each planet: planets grow as the pointer comes near
    let pointer: { x: number; y: number } | null = null;
    const screenOf = (v: THREE.Vector3): { x: number; y: number; behind: boolean } => {
      const p = v.clone().project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height, behind: p.z > 1 };
    };
    const nearest = (): Hover | null => {
      if (!pointer) return null;
      let best: Hover | null = null, bestD = 90;
      for (const [id, m] of markers) {
        const s = screenOf(m.planet.getWorldPosition(new THREE.Vector3()));
        if (s.behind) continue;
        const d = Math.hypot(s.x - pointer.x, s.y - pointer.y);
        if (d < bestD) { bestD = d; best = { id, x: s.x, y: s.y }; }
      }
      return best;
    };
    let hovered: string | null = null;
    const onMove = (e: PointerEvent): void => {
      if (live.current.mode !== 'hub') return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = (): void => { pointer = null; };
    const onClick = (): void => { if (live.current.mode !== 'hub') return; live.current.onPick?.(hovered); };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('click', onClick);

    api.current = {
      dive: (id, ms) => new Promise<void>((resolve) => {
        const m = markers.get(id);
        const target = m ? m.planet.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const from = camera.position.clone(), fromT = controls.target.clone();
        const dir = from.clone().sub(target).normalize();
        const to = target.clone().add(dir.multiplyScalar(PLANET_R * 1.55));
        diving = true; controls.enabled = false;
        const t0 = performance.now();
        const step = (now: number): void => {
          const k = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms), e = ease(k);
          const ke = 1 - Math.pow(1 - e, 1.6);
          camera.position.lerpVectors(from, to, ke); controls.target.lerpVectors(fromT, target, e);
          camera.lookAt(controls.target);
          if (k < 1) requestAnimationFrame(step); else { diving = false; resolve(); }
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
        const a = now * 0.00004;
        camera.position.set(Math.sin(a) * 230, 150, Math.cos(a) * 230);
        camera.lookAt(0, 8, 0);
      }
      if (L.mode === 'hub' && L.focusId && !diving && !(controls as unknown as { _focused?: string })._focused) {
        const p = positions.get(L.focusId); if (p) { controls.target.set(p.x, LIFT * 0.6, p.z); camera.position.set(p.x + 40, 70, p.z + 90); (controls as unknown as { _focused?: string })._focused = L.focusId; }
      }
      stars.rotation.y += dt * 0.003;
      chartGroup.rotation.y = stars.rotation.y;
      const near = L.mode === 'hub' ? nearest() : null;
      const nid = near?.id ?? null;
      if (nid !== hovered) { hovered = nid; setHoverId(nid); renderer.domElement.style.cursor = nid ? 'pointer' : 'grab'; }
      for (const [id, m] of markers) {
        const want = id === nid ? 1.75 : id === L.highlightId ? 1.25 : 1;
        m.scale += (want - m.scale) * Math.min(1, dt * 10);
        m.planet.scale.setScalar(m.scale);
        m.planet.children[0]!.rotation.y += dt * (id === nid ? 0.6 : 0.15);
        m.planet.position.y = LIFT + Math.sin(now * 0.0012 + id.length) * 0.6;
      }
      for (const b of boxes) b.quaternion.copy(camera.quaternion).premultiply(chartGroup.quaternion.clone().invert());
      // keep the card next to the planet it describes
      if (card.current && nid) {
        const m = markers.get(nid)!;
        const s = screenOf(m.planet.getWorldPosition(new THREE.Vector3()));
        card.current.style.transform = `translate(${Math.round(s.x + PLANET_R * 9 * m.scale)}px, ${Math.round(s.y - 30)}px)`;
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('pointerleave', onLeave); renderer.domElement.removeEventListener('click', onClick);
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.(); });
      dot.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [props.planets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = hoverId ? props.planets.find((p) => p.id === hoverId) : undefined;
  return (
    <div ref={host} className="galaxy" style={{ position: 'absolute', inset: 0, background: '#f6f5f0' }}>
      {info && props.mode === 'hub' ? (
        <div ref={card} className="planet-card" role="tooltip">
          <i style={{ background: `hsl(${Math.round(info.hue * 360)} 62% 55%)` }} />
          <b>{info.name}</b>
          {info.doc ? <span>{info.doc}</span> : null}
          {info.hosting ? <em>Hosting this week's tournament</em> : null}
          {typeof info.players === 'number' ? <em>{info.players} playing</em> : null}
          <small>Click to see more</small>
        </div>
      ) : null}
    </div>
  );
});
