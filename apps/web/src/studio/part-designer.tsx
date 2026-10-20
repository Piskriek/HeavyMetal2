// ============================================================================
// File: apps/web/src/studio/part-designer.tsx
// The Parts workspace (plans 38 and 39): the Shape Press's twin of the Material Designer. Pick a generator, move the
// sliders its schema gives, choose a material per slot, and scrub the stage ladder to watch the part gain detail.
// "Copy as JSON" gives the part cartridge ({ gen, params, slotMaterials }) the Drafting Table and agents use.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GENERATORS, resolveParams, triangleCount, type MeshData, type Rank } from '@hm/partgen';
import { maxRank } from '@hm/kitspec';
import { DEFAULT_SLOT_MATERIAL, formatValue, PART_SWATCHES } from '../play/part-swatches';
import './part-designer.css';

const STAGES = [0, 1, 2, 3, 4, 5, 6] as const;
const RANK_NAMES = ['Silhouette', 'Forms', 'Small details'] as const;

const defaultSlots = (gen: string): Record<string, string> =>
  Object.fromEntries((GENERATORS[gen]?.slots ?? []).map((s) => [s, DEFAULT_SLOT_MATERIAL[s] ?? 'paint']));

function toGeometry(md: MeshData, slotNames: readonly string[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(md.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(md.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(md.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(md.indices, 1));
  for (const s of md.slots) g.addGroup(s.start, s.count, Math.max(0, slotNames.indexOf(s.name)));
  return g;
}

export const PartDesigner: React.FC = () => {
  const [gen, setGen] = useState<string>('bolt');
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const [slots, setSlots] = useState<Record<string, Record<string, string>>>({});
  const [stage, setStage] = useState<number>(6);
  const [copied, setCopied] = useState<boolean>(false);

  const generator = GENERATORS[gen] ?? GENERATORS.bolt!;
  const params = useMemo(() => resolveParams(generator.params, values[gen] ?? {}), [generator, values, gen]);
  const slotMaterials = useMemo(() => slots[gen] ?? defaultSlots(gen), [slots, gen]);
  const rank: Rank = maxRank(stage, 'high');
  const mesh = useMemo(() => generator.build(params, rank), [generator, params, rank]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<{ part: THREE.Mesh; camera: THREE.PerspectiveCamera; controls: OrbitControls; grid: THREE.GridHelper; mats: Map<string, THREE.MeshStandardMaterial> } | null>(null);

  // the viewport: built once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 200);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x1a2230, 1.1));
    const key = new THREE.DirectionalLight(0xfff3e0, 2.4);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight(0x5fd4ff, 0.6);
    rim.position.set(-4, 2, -3);
    scene.add(key, rim);
    const grid = new THREE.GridHelper(1, 10, 0x2c3d51, 0x1c2734);
    scene.add(grid);
    const mats = new Map(PART_SWATCHES.map((s) => [s.id, new THREE.MeshStandardMaterial({ color: s.color, metalness: s.metal, roughness: s.rough, flatShading: true })]));
    const part = new THREE.Mesh(new THREE.BufferGeometry(), [...mats.values()]);
    scene.add(part);
    viewRef.current = { part, camera, controls, grid, mats };

    let frame = 0;
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
    const loop = (): void => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      part.geometry.dispose();
      mats.forEach((m) => m.dispose());
      grid.geometry.dispose();
      renderer.dispose();
      viewRef.current = null;
    };
  }, []);

  // the part: rebuilt on every slider, slot or stage change
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const old = v.part.geometry;
    v.part.geometry = toGeometry(mesh, generator.slots);
    old.dispose();
    v.part.material = generator.slots.map((s) => v.mats.get(slotMaterials[s] ?? 'paint') as THREE.Material);
  }, [mesh, generator, slotMaterials]);

  // framing: on a new generator, and when the sliders change the part's size by more than 2x; small tuning leaves the
  // camera where you put it
  const framed = useRef<{ gen: string; span: number } | null>(null);
  const fullMesh = useMemo(() => generator.build(params, 2), [generator, params]);
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const md = fullMesh;
    const span = Math.max(md.max[0] - md.min[0], md.max[1] - md.min[1], md.max[2] - md.min[2], 0.02);
    const last = framed.current;
    if (last && last.gen === gen && span < last.span * 2 && span > last.span / 2) return;
    framed.current = { gen, span };
    const cy = (md.min[1] + md.max[1]) / 2;
    v.controls.target.set((md.min[0] + md.max[0]) / 2, cy, (md.min[2] + md.max[2]) / 2);
    v.camera.position.set(span * 1.6, cy + span * 1.1, span * 2.0);
    v.camera.near = span / 200;
    v.camera.far = span * 200;
    v.camera.updateProjectionMatrix();
    v.grid.scale.setScalar(Math.pow(10, Math.ceil(Math.log10(span * 2))));
  }, [fullMesh, gen]);

  const setValue = (k: string, n: number): void => setValues((all) => ({ ...all, [gen]: { ...(all[gen] ?? {}), [k]: n } }));
  const setSlot = (slot: string, mat: string): void => setSlots((all) => ({ ...all, [gen]: { ...slotMaterials, [slot]: mat } }));
  const cartridge = { kind: 'setmix.part', gen, params, slotMaterials };
  const copy = (): void => {
    void navigator.clipboard?.writeText(JSON.stringify(cartridge, null, 2)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div className="sx-part" data-testid="studio-parts-tab">
      <div className="sx-part-view">
        <canvas ref={canvasRef} aria-label={`${generator.label} preview. Drag to orbit, scroll to zoom.`} />
        <div className="sx-part-ladder" role="group" aria-label="Stage preview">
          <div className="sx-part-stops">
            {STAGES.map((s) => (
              <button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)}
                title={`Stage ${s}: draws up to ${RANK_NAMES[maxRank(s, 'high')]}`} data-testid={`part-stage-${s}`}>
                <span>{s}</span>
              </button>
            ))}
          </div>
          <p className="sx-part-readout" data-testid="part-readout">
            <b>{RANK_NAMES[rank]}</b>
            <span>{triangleCount(mesh).toLocaleString()} triangles</span>
          </p>
        </div>
      </div>

      <aside className="sx-part-side" aria-label="Part controls">
        <header className="sx-part-head">
          <h3>{generator.label}</h3>
          <div className="sx-part-gens" role="group" aria-label="Part">
            {Object.values(GENERATORS).map((g) => (
              <button key={g.id} type="button" aria-pressed={gen === g.id} onClick={() => setGen(g.id)} data-testid={`part-gen-${g.id}`}>{g.label}</button>
            ))}
          </div>
        </header>

        <section className="sx-part-section" aria-label="Shape">
          <h4>Shape</h4>
          {generator.params.map((spec) => {
            const v = params[spec.key] ?? spec.default;
            if (spec.unit === 'choice') {
              return (
                <div key={spec.key} className="sx-part-row">
                  <span className="sx-part-label">{spec.label}</span>
                  <div className="sx-seg" role="group" aria-label={spec.label}>
                    {(spec.choices ?? []).map((c, i) => (
                      <button key={c} type="button" aria-pressed={v === spec.min + i} onClick={() => setValue(spec.key, spec.min + i)}>{c}</button>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <label key={spec.key} className="sx-part-row">
                <span className="sx-part-label">{spec.label}</span>
                <output>{formatValue(spec, v)}</output>
                <input type="range" min={spec.min} max={spec.max} step={spec.step} value={v}
                  onChange={(e) => setValue(spec.key, Number(e.currentTarget.value))} data-testid={`part-param-${spec.key}`} />
              </label>
            );
          })}
        </section>

        <section className="sx-part-section" aria-label="Materials">
          <h4>Materials</h4>
          {generator.slots.map((slot) => (
            <div key={slot} className="sx-part-row">
              <span className="sx-part-label">{slot[0]!.toUpperCase() + slot.slice(1)}</span>
              <div className="sx-part-swatches" role="radiogroup" aria-label={`${slot} material`}>
                {PART_SWATCHES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={slotMaterials[slot] === s.id} title={s.name} aria-label={s.name}
                    style={{ background: s.color }} onClick={() => setSlot(slot, s.id)} data-testid={`part-mat-${slot}-${s.id}`} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <footer className="sx-part-foot">
          <button type="button" onClick={() => setValues((all) => ({ ...all, [gen]: {} }))}>Reset shape</button>
          <button type="button" className="sx-go" onClick={copy} data-testid="part-copy">{copied ? 'Copied' : 'Copy as JSON'}</button>
        </footer>
      </aside>
    </div>
  );
};
