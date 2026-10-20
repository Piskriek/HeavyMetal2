// The part's live preview on the bench's Parts page and the planet's Drafting Table (TICKET-32; the owner, 2026-10-20: "there
// is gona be a preview of the thing where you have those sliders, else the sliders are useless", and "we want to use
// previews to stimulate the players creativity"). It shows the mesh the cartridge prints: the generator at full detail,
// the sliders, the one-click operators and each slot's material, and whatever the player is hovering to try on. It turns
// slowly; drag to orbit, wheel to zoom. Its own small WebGL context lives only while the page is open and is released on
// close (the min-spec laptop: a GTX 950M). The same context renders the part chips' thumbnails, once a session.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PartSpec } from '@hm/cartlab';
import { GENERATORS, resolveParams, type MeshData } from '@hm/partgen';
import { applyOps } from './part-cartridge';
import { DEFAULT_SLOT_MATERIAL, PART_SWATCHES } from './part-swatches';

/** A part mesh as a three.js geometry, one draw group per material slot (in `slotNames` order). */
export function partGeometry(md: MeshData, slotNames: readonly string[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(md.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(md.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(md.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(md.indices, 1));
  for (const s of md.slots) g.addGroup(s.start, s.count, Math.max(0, slotNames.indexOf(s.name)));
  return g;
}

/** The printed mesh: the generator at full detail with the cartridge's operators (an operator that throws is skipped). */
function printedMesh(spec: PartSpec): MeshData | null {
  const g = GENERATORS[spec.gen];
  if (!g) return null;
  const base = g.build(spec.params, 2);
  try {
    return applyOps(base, spec.ops);
  } catch {
    return base;
  }
}

/** The slot names a mesh draws, the generator's first (operators such as edge wear add their own). */
const slotNamesOf = (gen: string, md: MeshData | null): readonly string[] => {
  const names = [...(GENERATORS[gen]?.slots ?? [])];
  for (const s of md?.slots ?? []) if (!names.includes(s.name)) names.push(s.name);
  return names;
};

/** Points `camera` at the mesh from a three-quarter angle above, its bounding sphere filling the view. */
function frame(camera: THREE.PerspectiveCamera, target: THREE.Vector3, md: MeshData): void {
  const r = 0.5 * Math.hypot(md.max[0] - md.min[0], md.max[1] - md.min[1], md.max[2] - md.min[2]);
  const dist = (Math.max(r, 0.005) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.02;
  target.set((md.min[0] + md.max[0]) / 2, (md.min[1] + md.max[1]) / 2, (md.min[2] + md.max[2]) / 2);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(1, 0.95, 1.35).normalize(), dist);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

// ---- the part chips' thumbnails: each generator at its defaults, rendered once a session by the first preview opened
const THUMBS = new Map<string, string>();
const thumbListeners = new Set<() => void>();

/** The generators' thumbnails (data URLs by generator id); the component redraws when they arrive. */
export function usePartThumbs(): ReadonlyMap<string, string> {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = (): void => bump((n) => n + 1);
    thumbListeners.add(f);
    return () => { thumbListeners.delete(f); };
  }, []);
  return THUMBS;
}

function renderThumbs(renderer: THREE.WebGLRenderer, scene: THREE.Scene, part: THREE.Mesh, mats: ReadonlyMap<string, THREE.Material>): void {
  // rendered at twice the size and drawn down, which smooths the edges without a multisampled target
  const S = 192, OUT = 96;
  const rt = new THREE.WebGLRenderTarget(S, S);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const px = new Uint8Array(S * S * 4);
  const big = document.createElement('canvas');
  big.width = big.height = S;
  const small = document.createElement('canvas');
  small.width = small.height = OUT;
  const bigCtx = big.getContext('2d'), smallCtx = small.getContext('2d');
  if (!bigCtx || !smallCtx) return;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 100);
  const target = new THREE.Vector3();
  const old = part.geometry;
  for (const g of Object.values(GENERATORS)) {
    const md = g.build(resolveParams(g.params, {}), 2);
    const names = slotNamesOf(g.id, md);
    part.geometry = partGeometry(md, names);
    // the chips are for telling shapes apart on a dark panel: light paint everywhere, a hazard band where a part has one
    part.material = names.map((s) => mats.get(s === 'band' ? 'hazard' : 'paint')!);
    frame(camera, target, md);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
    part.geometry.dispose();
    const img = bigCtx.createImageData(S, S);
    for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    bigCtx.putImageData(img, 0, 0);
    smallCtx.clearRect(0, 0, OUT, OUT);
    smallCtx.drawImage(big, 0, 0, OUT, OUT);
    THUMBS.set(g.id, small.toDataURL('image/png'));
  }
  renderer.setRenderTarget(null);
  rt.dispose();
  part.geometry = old;
  thumbListeners.forEach((f) => f());
}

const sizeText = (d: readonly number[]): string =>
  Math.max(...d) >= 1 ? `${d.map((x) => x.toFixed(2)).join(' × ')} m` : `${d.map((x) => Math.round(x * 1000)).join(' × ')} mm`;

export interface PartPreviewProps {
  readonly spec: PartSpec;
  /** What the player is trying on (hovering), shown as a tag over the view; null when the view shows the part as set. */
  readonly trying?: string | null;
}

export const PartPreview: React.FC<PartPreviewProps> = ({ spec, trying = null }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<{ part: THREE.Mesh; camera: THREE.PerspectiveCamera; controls: OrbitControls; grid: THREE.GridHelper; mats: Map<string, THREE.Material> } | null>(null);
  const mesh = useMemo(() => printedMesh(spec), [spec]);
  const slotNames = useMemo(() => slotNamesOf(spec.gen, mesh), [spec.gen, mesh]);

  // the view: built once per page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 200);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotateSpeed = 1.6;
    // a hand on the part stops the turntable; it stays where it was left
    const stop = (): void => { controls.autoRotate = false; };
    controls.addEventListener('start', stop);
    // a product-shot rig: a bright sky fill, a warm key from above right, a front fill and a cool rim, so dark metals read
    scene.add(new THREE.HemisphereLight(0xe8f1fa, 0x2a3442, 2.2));
    const key = new THREE.DirectionalLight(0xfff3e0, 3.2);
    key.position.set(3, 5, 4);
    const fill = new THREE.DirectionalLight(0xdfe9f3, 1.2);
    fill.position.set(-2, 1, 4);
    const rim = new THREE.DirectionalLight(0x5fd4ff, 1.4);
    rim.position.set(-4, 2, -3);
    scene.add(key, fill, rim);
    const mats = new Map<string, THREE.Material>(PART_SWATCHES.map((s) => [s.id, new THREE.MeshStandardMaterial({ color: s.color, metalness: s.metal, roughness: s.rough, flatShading: true })]));
    const part = new THREE.Mesh(new THREE.BufferGeometry(), [...mats.values()]);
    scene.add(part);
    if (THUMBS.size === 0) renderThumbs(renderer, scene, part, mats);
    const grid = new THREE.GridHelper(1, 10, 0x2c3d51, 0x1c2734);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    scene.add(grid);
    viewRef.current = { part, camera, controls, grid, mats };

    const size = (): void => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(size);
    observer.observe(canvas);
    size();
    let raf = 0;
    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.removeEventListener('start', stop);
      controls.dispose();
      part.geometry.dispose();
      mats.forEach((m) => m.dispose());
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      viewRef.current = null;
    };
  }, []);

  // the part: rebuilt on every slider, operator or material change, and on every try-on
  useEffect(() => {
    const v = viewRef.current;
    if (!v || !mesh) return;
    const old = v.part.geometry;
    v.part.geometry = partGeometry(mesh, slotNames);
    old.dispose();
    v.part.material = slotNames.map((s) => v.mats.get(spec.slotMaterials[s] ?? DEFAULT_SLOT_MATERIAL[s] ?? 'paint') ?? v.mats.get('paint')!);
  }, [mesh, slotNames, spec.slotMaterials]);

  // framing: on a new generator, as soon as the part outgrows the view, and when it shrinks well inside it (a try-on of
  // a mirror zooms out, and back in when it ends); small tuning inside the view keeps it where the player turned it
  const framed = useRef<{ gen: string; r: number } | null>(null);
  useEffect(() => {
    const v = viewRef.current;
    if (!v || !mesh) return;
    const r = 0.5 * Math.hypot(mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]);
    const last = framed.current;
    if (last && last.gen === spec.gen && r <= last.r * 1.08 && r > last.r * 0.7) return;
    framed.current = { gen: spec.gen, r };
    frame(v.camera, v.controls.target, mesh);
    v.grid.scale.setScalar(Math.pow(10, Math.ceil(Math.log10(Math.max(r, 0.01) * 4))));
  }, [mesh, spec.gen]);

  const dims = mesh ? [mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]] : null;
  return (
    <figure className={`part-preview${trying ? ' trying' : ''}`} data-testid="part-preview">
      <canvas ref={canvasRef} aria-label={`Preview of ${spec.name}`} />
      {trying ? <span className="part-preview-trying" data-testid="part-preview-trying">Trying {trying}. Click to keep it.</span> : null}
      {dims ? (
        <figcaption>
          <span>{sizeText(dims)}</span>
          <span>{Math.round(mesh!.indices.length / 3)} tris</span>
        </figcaption>
      ) : null}
    </figure>
  );
};
