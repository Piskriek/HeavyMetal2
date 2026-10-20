// ============================================================================
// File: apps/web/src/studio/part-designer.tsx
// The Parts workspace (plans 38 and 39; layout per ARGO_NOTE_34 section 3): the Shape Press's twin of the Material
// Designer. Pick a generator and move the sliders its schema gives (Part), stack mesh operators on it non-destructively
// (Stack: add any of the 27, reorder, mute, a named preset, a minimum detail rank, the operator's own sliders), choose a
// material per slot, and scrub the stage ladder to watch the part gain detail. "Copy as JSON" gives the part cartridge
// ({ gen, params, slotMaterials, ops, stack }) the bench and agents use.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GENERATORS, resolveParams, triangleCount, type MeshData, type ParamSpec, type Rank } from '@hm/partgen';
import { evaluateOperatorStack, MESH_OPERATORS, OPERATOR_FAMILIES, type OperatorStackLayer } from '@hm/meshops';
import { maxRank } from '@hm/kitspec';
import { DEFAULT_SLOT_MATERIAL, formatValue, PART_SWATCHES } from '../play/part-swatches';
import './part-designer.css';

const STAGES = [0, 1, 2, 3, 4, 5, 6] as const;
const RANK_NAMES = ['Silhouette', 'Forms', 'Small details'] as const;
const RANK_SHORT = ['R0', 'R1', 'R2'] as const;
const slotLabel = (s: string): string => (s[0]!.toUpperCase() + s.slice(1)).replace(/-/g, ' ');

function toGeometry(md: MeshData, slotNames: readonly string[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(md.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(md.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(md.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(md.indices, 1));
  for (const s of md.slots) g.addGroup(s.start, s.count, Math.max(0, slotNames.indexOf(s.name)));
  return g;
}

/** A part's stack run safely: an operator that throws leaves the mesh as it was before it, and says which one. */
function runStack(base: MeshData, stack: readonly OperatorStackLayer[], rank: Rank): { mesh: MeshData; error: string | null } {
  try {
    return { mesh: evaluateOperatorStack(base, stack, MESH_OPERATORS, rank), error: null };
  } catch (e) {
    let mesh = base;
    for (const layer of stack) {
      if (!layer.enabled || layer.minRank > rank) continue;
      const op = MESH_OPERATORS[layer.operatorId];
      try {
        if (op) mesh = op.apply(mesh, layer.params);
      } catch {
        return { mesh, error: `${op?.label ?? layer.operatorId} could not run on this shape (${(e as Error).message})` };
      }
    }
    return { mesh, error: null };
  }
}

/** One slider (or a choice) from a schema. */
const Slider: React.FC<{ spec: ParamSpec; value: number; onChange: (n: number) => void; testId?: string }> = ({ spec, value, onChange, testId }) => {
  if (spec.unit === 'choice') {
    return (
      <div className="sx-part-row">
        <span className="sx-part-label">{spec.label}</span>
        <div className="sx-seg" role="group" aria-label={spec.label}>
          {(spec.choices ?? []).map((c, i) => (
            <button key={c} type="button" aria-pressed={value === spec.min + i} onClick={() => onChange(spec.min + i)}>{c}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="sx-part-row">
      <span className="sx-part-label">{spec.label}</span>
      <output>{formatValue(spec, value)}</output>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))} data-testid={testId} />
    </label>
  );
};

export const PartDesigner: React.FC = () => {
  const [gen, setGen] = useState<string>('bolt');
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const [slots, setSlots] = useState<Record<string, Record<string, string>>>({});
  const [stacks, setStacks] = useState<Record<string, OperatorStackLayer[]>>({});
  const [panel, setPanel] = useState<'part' | 'stack'>('part');
  const [open, setOpen] = useState<string | null>(null);
  const [stage, setStage] = useState<number>(6);
  const [copied, setCopied] = useState<boolean>(false);
  const nextLayer = useRef(1);

  const generator = GENERATORS[gen] ?? GENERATORS.bolt!;
  const params = useMemo(() => resolveParams(generator.params, values[gen] ?? {}), [generator, values, gen]);
  const stack = useMemo(() => stacks[gen] ?? [], [stacks, gen]);
  const rank: Rank = maxRank(stage, 'high');
  const base = useMemo(() => generator.build(params, rank), [generator, params, rank]);
  const { mesh, error } = useMemo(() => runStack(base, stack, rank), [base, stack, rank]);
  /** Every slot the final mesh draws: the generator's, plus any an operator added (edge wear, cavity dirt). */
  const slotNames = useMemo(() => [...new Set([...generator.slots, ...mesh.slots.map((s) => s.name)])], [generator, mesh]);
  const slotMaterials = useMemo(
    () => Object.fromEntries(slotNames.map((s) => [s, slots[gen]?.[s] ?? DEFAULT_SLOT_MATERIAL[s] ?? 'paint'])),
    [slotNames, slots, gen],
  );

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

  // the part: rebuilt on every slider, layer, slot or stage change
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const old = v.part.geometry;
    v.part.geometry = toGeometry(mesh, slotNames);
    old.dispose();
    v.part.material = slotNames.map((s) => v.mats.get(slotMaterials[s] ?? 'paint') as THREE.Material);
  }, [mesh, slotNames, slotMaterials]);

  // framing: on a new generator, and when the part's size changes by more than 2x; small tuning leaves the camera where you put it
  const framed = useRef<{ gen: string; span: number } | null>(null);
  const fullMesh = useMemo(() => runStack(generator.build(params, 2), stack, 2).mesh, [generator, params, stack]);
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
  const setSlot = (slot: string, mat: string): void => setSlots((all) => ({ ...all, [gen]: { ...(all[gen] ?? {}), [slot]: mat } }));
  const setStack = (next: OperatorStackLayer[]): void => setStacks((all) => ({ ...all, [gen]: next }));
  const addLayer = (operatorId: string): void => {
    const op = MESH_OPERATORS[operatorId];
    if (!op) return;
    const layerId = `L${nextLayer.current++}`;
    setStack([...stack, { layerId, operatorId, enabled: true, minRank: 0, params: { ...op.oneClickPreset } }]);
    setOpen(layerId);
  };
  const patchLayer = (i: number, patch: Partial<OperatorStackLayer>): void =>
    setStack(stack.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const moveLayer = (i: number, d: -1 | 1): void => {
    const j = i + d;
    if (j < 0 || j >= stack.length) return;
    const next = [...stack];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setStack(next);
  };

  const cartridge = {
    kind: 'setmix.part',
    gen,
    params,
    slotMaterials,
    ops: stack.filter((l) => l.enabled).map((l) => ({ op: l.operatorId, params: l.params })),
    stack,
  };
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
        {error ? <p className="sx-part-error" role="alert">{error}</p> : null}
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
          <div className="sx-seg sx-part-panels" role="tablist" aria-label="Edit">
            <button type="button" role="tab" aria-selected={panel === 'part'} aria-pressed={panel === 'part'} onClick={() => setPanel('part')} data-testid="part-panel-part">Part</button>
            <button type="button" role="tab" aria-selected={panel === 'stack'} aria-pressed={panel === 'stack'} onClick={() => setPanel('stack')} data-testid="part-panel-stack">
              Stack{stack.length > 0 ? ` (${stack.length})` : ''}
            </button>
          </div>
        </header>

        {panel === 'part' ? (
          <>
            <section className="sx-part-section" aria-label="Shape">
              <h4>Shape</h4>
              {generator.params.map((spec) => (
                <Slider key={spec.key} spec={spec} value={params[spec.key] ?? spec.default} onChange={(n) => setValue(spec.key, n)} testId={`part-param-${spec.key}`} />
              ))}
            </section>

            <section className="sx-part-section" aria-label="Materials">
              <h4>Materials</h4>
              {slotNames.map((slot) => (
                <div key={slot} className="sx-part-row">
                  <span className="sx-part-label">{slotLabel(slot)}</span>
                  <div className="sx-part-swatches" role="radiogroup" aria-label={`${slot} material`}>
                    {PART_SWATCHES.map((s) => (
                      <button key={s.id} type="button" role="radio" aria-checked={slotMaterials[slot] === s.id} title={s.name} aria-label={s.name}
                        style={{ background: s.color }} onClick={() => setSlot(slot, s.id)} data-testid={`part-mat-${slot}-${s.id}`} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="sx-part-section sx-part-stack" aria-label="Operator stack">
            <label className="sx-part-add">
              <span className="sx-part-label">Add an operator</span>
              <select value="" onChange={(e) => { if (e.currentTarget.value) addLayer(e.currentTarget.value); }} data-testid="part-add-op">
                <option value="">Choose…</option>
                {OPERATOR_FAMILIES.map((f) => (
                  <optgroup key={f.id} label={f.label}>
                    {Object.values(MESH_OPERATORS).filter((o) => o.family === f.id).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {stack.length === 0 ? (
              <p className="sx-part-empty">No operators yet. Each one reshapes the part without touching its sliders, in order from the top; mute or reorder them any time.</p>
            ) : (
              <ol className="sx-part-layers">
                {stack.map((layer, i) => {
                  const op = MESH_OPERATORS[layer.operatorId];
                  if (!op) return null;
                  const expanded = open === layer.layerId;
                  const skipped = layer.enabled && layer.minRank > rank;
                  return (
                    <li key={layer.layerId} className={`sx-part-layer${layer.enabled ? '' : ' muted'}`} data-testid={`part-layer-${i}`}>
                      <div className="sx-part-layer-head">
                        <input type="checkbox" checked={layer.enabled} onChange={(e) => patchLayer(i, { enabled: e.currentTarget.checked })}
                          aria-label={`${op.label}: on`} data-testid={`part-layer-${i}-on`} />
                        <button type="button" className="sx-part-layer-name" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : layer.layerId)}>
                          {op.label}
                          {skipped ? <em> skipped at this stage</em> : null}
                        </button>
                        <span className="sx-part-layer-tools">
                          <button type="button" onClick={() => moveLayer(i, -1)} disabled={i === 0} aria-label={`Move ${op.label} up`} title="Move up">▲</button>
                          <button type="button" onClick={() => moveLayer(i, 1)} disabled={i === stack.length - 1} aria-label={`Move ${op.label} down`} title="Move down">▼</button>
                          <button type="button" onClick={() => setStack(stack.filter((_, j) => j !== i))} aria-label={`Remove ${op.label}`} title="Remove" data-testid={`part-layer-${i}-remove`}>✕</button>
                        </span>
                      </div>
                      {expanded ? (
                        <div className="sx-part-layer-body">
                          <p className="sx-part-layer-about">{op.description}</p>
                          <div className="sx-part-row">
                            <span className="sx-part-label" title="The lowest detail rank this layer runs at: R1 and R2 layers skip themselves on Low and at early stages">Runs from</span>
                            <div className="sx-seg" role="group" aria-label={`${op.label}: lowest rank`}>
                              {RANK_SHORT.map((r, k) => (
                                <button key={r} type="button" aria-pressed={layer.minRank === k} onClick={() => patchLayer(i, { minRank: k as Rank })}>{r}</button>
                              ))}
                            </div>
                          </div>
                          {Object.keys(op.namedPresets).length > 0 ? (
                            <label className="sx-part-row">
                              <span className="sx-part-label">Preset</span>
                              <select value="" onChange={(e) => {
                                const p = op.namedPresets[e.currentTarget.value];
                                if (p) patchLayer(i, { params: { ...op.oneClickPreset, ...p } });
                              }}>
                                <option value="">{op.oneClickPresetLabel}</option>
                                {Object.keys(op.namedPresets).map((k) => <option key={k} value={k}>{k.replace(/-/g, ' ')}</option>)}
                              </select>
                            </label>
                          ) : null}
                          {op.params.map((spec) => (
                            <Slider key={spec.key} spec={spec} value={layer.params[spec.key] ?? spec.default}
                              onChange={(n) => patchLayer(i, { params: { ...layer.params, [spec.key]: n } })} />
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}

        <footer className="sx-part-foot">
          <button type="button" onClick={() => (panel === 'stack' ? setStack([]) : setValues((all) => ({ ...all, [gen]: {} })))}>
            {panel === 'stack' ? 'Clear stack' : 'Reset shape'}
          </button>
          <button type="button" className="sx-go" onClick={copy} data-testid="part-copy">{copied ? 'Copied' : 'Copy as JSON'}</button>
        </footer>
      </aside>
    </div>
  );
};
