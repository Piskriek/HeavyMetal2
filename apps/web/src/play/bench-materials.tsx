// The preset bench's Materials page, Machines shelf (plan 41 section 4.7): a layered material, built the way Substance's
// smart materials are: pick one from the shelf, give it its two paints, then tune its stack of layers (each a surface
// placed by a "where" mask: rust in the crevices, dust on the tops, wear on the edges), and its age. The cartridge goes
// in the beam rifle; Apply puts the material on the part it is fired at (a hold, every part of the machine that wore
// the same). Same vocabulary as the Parts page, and the same previews rule: a live test piece pinned on top, the shelf
// as thumbnails, surfaces as lit balls, every choice tried on by hover, and a mask view that shows where a layer lands.
import React, { useMemo, useState } from 'react';
import {
  LAYER_SHELF,
  MASK_SHELF,
  MATERIAL_SHELF,
  MAX_LAYERS,
  SURFACE_SHELF,
  materialName,
  type LayerSpec,
  type MaterialSpec,
  type SurfaceSpec,
} from '@hm/matstack';
import type { MaterialPrintSpec } from '@hm/cartlab';
import { MaterialPreview, useMaterialThumbs } from './material-preview';
import { materialBall } from './part-swatches';
import type { MyPreset } from './my-presets';
import './bench-parts.css';

export interface BenchMaterialsProps {
  /** Whether printing this material can start now, and why not (the bench, the blank, the power). */
  readonly check: (print: MaterialPrintSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (print: MaterialPrintSpec) => void;
  readonly printLabel?: string;
  /** The number of the first step on this page (the lab bench's step 1 is picking the blank). */
  readonly firstStep?: number;
  /** The player's saved materials ("Yours", plan 39 section 7), offered after the shelf. */
  readonly mine?: readonly MyPreset[];
  /** Keeps the current material in the player's presets. */
  readonly onSave?: (print: MaterialPrintSpec) => void;
  /** Reads a saved material back from its name (mat: or matc:). */
  readonly specOf: (ref: string) => MaterialSpec | null;
}

/** The paints a material can wear: the game's machine colours, named for people. */
const PAINTS: readonly { readonly hex: string; readonly name: string }[] = [
  { hex: '#b8b2a2', name: 'Khaki' }, { hex: '#e6e8ea', name: 'Lab white' }, { hex: '#eab308', name: 'Hazard yellow' },
  { hex: '#e5772e', name: 'Safety orange' }, { hex: '#3c9a5a', name: 'Signal green' }, { hex: '#5d7a99', name: 'Steel blue' },
  { hex: '#2c3e66', name: 'Navy' }, { hex: '#8a3b2a', name: 'Oxide red' }, { hex: '#4a525a', name: 'Slate' },
  { hex: '#22262b', name: 'Black' },
];

const DEFAULT_ID = 'mat:field-worn-hazard';
const SHELF = Object.entries(MATERIAL_SHELF).map(([id, spec]) => ({ id, spec }));
const label = (id: string): string => (MATERIAL_SHELF[id]?.name ?? id.replace(/^mat:/, '').replace(/-/g, ' '));

/** A surface as a lit ball: its colour (its paint when it is painted), how metal and how rough. */
const surfaceBall = (s: SurfaceSpec, paint: readonly [string, string]): string => {
  const c = s.colour === 'paint1' ? paint[0] : s.colour === 'paint2' ? paint[1] : s.ramp?.[Math.floor(s.ramp.length / 2)]?.colour ?? s.colour;
  return materialBall({ color: c, metal: s.metal, rough: s.rough });
};

/** What the player is trying on: another material, a paint, a surface or a "where" for a layer, or a new layer. */
type Trial = { readonly label: string; readonly spec: MaterialSpec };

export const BenchMaterials: React.FC<BenchMaterialsProps> = ({ check, onPrint, printLabel = 'Start printing', firstStep = 2, mine = [], onSave, specOf }) => {
  const [presetId, setPresetId] = useState(DEFAULT_ID);
  const [spec, setSpec] = useState<MaterialSpec>(() => MATERIAL_SHELF[DEFAULT_ID]!);
  /** The open layer, by its index in spec.layers (bottom first); -1 when none is open. */
  const [open, setOpen] = useState(-1);
  const [showWhere, setShowWhere] = useState(false);
  const [trial, setTrial] = useState<Trial | null>(null);
  const thumbs = useMaterialThumbs();

  const shown = trial?.spec ?? spec;
  const mineSpecs = useMemo(
    () => mine.flatMap((p) => ('material' in p.print ? [{ id: p.id, name: p.print.material.name, spec: specOf(p.print.material.ref) }] : []))
      .filter((m): m is { id: string; name: string; spec: MaterialSpec } => m.spec !== null),
    [mine, specOf],
  );
  const thumbList = useMemo(() => [...SHELF, ...mineSpecs.map((m) => ({ id: m.id, spec: m.spec }))], [mineSpecs]);
  const print = useMemo<MaterialPrintSpec>(() => ({ name: spec.name, ref: materialName(spec) }), [spec]);
  const can = check(print);
  // the mask view counts the layers that draw (hidden ones are left out of the shader)
  const visibleIndex = open >= 0 && spec.layers[open]?.visible ? spec.layers.slice(0, open).filter((l) => l.visible).length : -1;

  const tryOn = (t: Trial) => ({
    onMouseEnter: () => setTrial(t),
    onMouseLeave: () => setTrial(null),
    onFocus: () => setTrial(t),
    onBlur: () => setTrial(null),
  });
  /** A change the player keeps: the material becomes theirs, named after where it came from. */
  const keep = (next: MaterialSpec): void => {
    setTrial(null);
    const fromShelf = presetId.startsWith('mat:') && !next.name.endsWith(', tuned');
    setSpec({ ...next, name: fromShelf ? `${label(presetId)}, tuned` : next.name });
  };
  const withLayer = (i: number, patch: Partial<LayerSpec>): MaterialSpec => ({ ...spec, layers: spec.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const move = (i: number, by: number): MaterialSpec => {
    const j = i + by;
    if (j < 0 || j >= spec.layers.length) return spec;
    const layers = [...spec.layers];
    [layers[i], layers[j]] = [layers[j]!, layers[i]!];
    return { ...spec, layers };
  };
  const pick = (id: string, m: MaterialSpec): void => {
    setTrial(null);
    setPresetId(id);
    setSpec(m);
    setOpen(-1);
  };

  const order = spec.layers.map((l, i) => ({ l, i })).reverse(); // top first, as a stack reads

  return (
    <div className="bench-parts bench-materials" data-testid="bench-materials">
      <div className="bench-parts-stage">
        <MaterialPreview spec={shown} trying={trial?.label ?? null} maskLayer={showWhere && !trial ? visibleIndex : -1} thumbs={thumbList} />
        <label className="bench-where-toggle">
          <input type="checkbox" checked={showWhere} disabled={visibleIndex < 0} onChange={(e) => setShowWhere(e.currentTarget.checked)} data-testid="bench-show-where" />
          <span>{visibleIndex < 0 ? 'Open a layer to see where it lands' : `Show where ${spec.layers[open]?.name.toLowerCase()} lands`}</span>
        </label>
      </div>

      <div className="play-carts">
        <h4>{firstStep}. Pick a material</h4>
        <div className="bench-parts-gens tiles">
          {SHELF.map(({ id, spec: m }) => (
            <button key={id} className={presetId === id ? 'on' : ''} onClick={() => pick(id, m)} data-testid={`bench-mat-${id.replace(/^mat:/, '')}`}
              {...(presetId === id ? {} : tryOn({ label: m.name.toLowerCase(), spec: m }))}>
              {thumbs.get(id) ? <img src={thumbs.get(id)} alt="" width={44} height={44} /> : <i aria-hidden="true" />}
              <b>{m.name}</b>
            </button>
          ))}
        </div>
        {mineSpecs.length > 0 ? (
          <>
            <p className="bench-parts-shelf">Yours</p>
            <div className="bench-parts-gens tiles">
              {mineSpecs.map((m) => (
                <button key={m.id} className={presetId === m.id ? 'on' : ''} onClick={() => pick(m.id, { ...m.spec, name: m.name })} data-testid={`bench-mine-${m.id}`}
                  {...tryOn({ label: m.name.toLowerCase(), spec: m.spec })}>
                  {thumbs.get(m.id) ? <img src={thumbs.get(m.id)} alt="" width={44} height={44} /> : <i aria-hidden="true" />}
                  <b>{m.name}</b>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="play-carts">
        <h4>{firstStep + 1}. Paint it</h4>
        {([0, 1] as const).map((k) => (
          <div key={k} className="bench-parts-row">
            <span>{k === 0 ? 'Main paint' : 'Second paint'}</span>
            <span className="bench-parts-swatches" role="radiogroup" aria-label={k === 0 ? 'Main paint' : 'Second paint'}>
              {PAINTS.map((p) => {
                const on = spec.paint[k].toLowerCase() === p.hex;
                const next: MaterialSpec = { ...spec, paint: k === 0 ? [p.hex, spec.paint[1]] : [spec.paint[0], p.hex] };
                return (
                  <button key={p.hex} role="radio" aria-checked={on} title={p.name} aria-label={p.name}
                    style={{ background: materialBall({ color: p.hex, metal: 0, rough: 0.55 }) }} data-testid={`bench-paint${k + 1}-${p.hex.slice(1)}`}
                    {...(on ? {} : tryOn({ label: `${p.name.toLowerCase()} paint`, spec: next }))}
                    onClick={() => keep(next)} />
                );
              })}
            </span>
          </div>
        ))}
      </div>

      <div className="play-carts">
        <h4>{firstStep + 2}. Weather it</h4>
        <ol className="bench-layers" aria-label="Layers, top first">
          {order.map(({ l, i }) => (
            <li key={`${i}-${l.name}`} className={`bench-layer${open === i ? ' open' : ''}${l.visible ? '' : ' hidden'}`} data-testid={`bench-layer-${i}`}>
              <div className="bench-layer-head">
                <button className="bench-layer-eye" aria-pressed={l.visible} aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
                  onClick={() => keep(withLayer(i, { visible: !l.visible }))} data-testid={`bench-layer-eye-${i}`}>{l.visible ? 'On' : 'Off'}</button>
                <i aria-hidden="true" className="bench-layer-ball" style={{ background: surfaceBall(l.surface, spec.paint) }} />
                <button className="bench-layer-name" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} data-testid={`bench-layer-open-${i}`}>
                  <b>{l.name}</b>
                  <span>{l.surface.name}, {l.mask.name.toLowerCase()}</span>
                </button>
                <input type="range" min={0} max={1} step={0.01} value={l.opacity} aria-label={`${l.name} strength`}
                  onChange={(e) => keep(withLayer(i, { opacity: Number(e.currentTarget.value) }))} data-testid={`bench-layer-opacity-${i}`} />
                <span className="bench-layer-moves">
                  <button aria-label={`Move ${l.name} up`} disabled={i === spec.layers.length - 1} onClick={() => { keep(move(i, 1)); setOpen(open === i ? i + 1 : open); }}>Up</button>
                  <button aria-label={`Move ${l.name} down`} disabled={i === 0} onClick={() => { keep(move(i, -1)); setOpen(open === i ? i - 1 : open); }}>Down</button>
                  <button aria-label={`Remove ${l.name}`} onClick={() => { keep({ ...spec, layers: spec.layers.filter((_, j) => j !== i) }); setOpen(-1); }}
                    data-testid={`bench-layer-remove-${i}`}>Remove</button>
                </span>
              </div>
              {open === i ? (
                <div className="bench-layer-body">
                  <p className="bench-parts-shelf">Surface</p>
                  <span className="bench-parts-swatches" role="radiogroup" aria-label={`${l.name} surface`}>
                    {Object.entries(SURFACE_SHELF).map(([sid, s]) => {
                      const on = l.surface.name === s.name;
                      const next = withLayer(i, { surface: s });
                      return (
                        <button key={sid} role="radio" aria-checked={on} title={s.name} aria-label={s.name}
                          style={{ background: surfaceBall(s, spec.paint) }} data-testid={`bench-surface-${sid}`}
                          {...(on ? {} : tryOn({ label: s.name.toLowerCase(), spec: next }))}
                          onClick={() => keep(next)} />
                      );
                    })}
                  </span>
                  <p className="bench-parts-shelf">Where</p>
                  <div className="bench-parts-ops" role="radiogroup" aria-label={`Where ${l.name} lands`}>
                    {Object.entries(MASK_SHELF).map(([mid, mk]) => {
                      const on = l.mask.name === mk.name;
                      const next = withLayer(i, { mask: mk });
                      return (
                        <button key={mid} role="radio" aria-checked={on} className={on ? 'on' : ''} data-testid={`bench-where-${mid}`}
                          {...(on ? {} : tryOn({ label: `${l.name.toLowerCase()} on ${mk.name.toLowerCase()}`, spec: next }))}
                          onClick={() => keep(next)}>{mk.name}</button>
                      );
                    })}
                  </div>
                  <label className="bench-parts-row">
                    <span>Amount</span>
                    <output>{Math.round(((l.mask.balance + 1) / 2) * 100)}%</output>
                    <input type="range" min={-1} max={1} step={0.01} value={l.mask.balance} data-testid={`bench-layer-amount-${i}`}
                      onChange={(e) => keep(withLayer(i, { mask: { ...l.mask, balance: Number(e.currentTarget.value) } }))} />
                  </label>
                  <label className="bench-parts-row">
                    <span>Sharpness</span>
                    <output>{Math.round(l.mask.contrast * 100)}%</output>
                    <input type="range" min={0} max={1} step={0.01} value={l.mask.contrast} data-testid={`bench-layer-sharpness-${i}`}
                      onChange={(e) => keep(withLayer(i, { mask: { ...l.mask, contrast: Number(e.currentTarget.value) } }))} />
                  </label>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="bench-parts-shelf">{spec.layers.length >= MAX_LAYERS ? `A material holds ${MAX_LAYERS} layers` : 'Add a layer on top'}</p>
        <div className="bench-parts-ops">
          {Object.entries(LAYER_SHELF).map(([lid, layer]) => {
            const next: MaterialSpec = { ...spec, layers: [...spec.layers, layer] };
            return (
              <button key={lid} disabled={spec.layers.length >= MAX_LAYERS} data-testid={`bench-add-${lid}`}
                {...(spec.layers.length >= MAX_LAYERS ? {} : tryOn({ label: `${layer.name.toLowerCase()} on top`, spec: next }))}
                onClick={() => { keep(next); setOpen(spec.layers.length); }}>{layer.name}</button>
            );
          })}
        </div>
        <label className="bench-parts-row bench-age">
          <span>Age</span>
          <output>{spec.age < 0.2 ? 'Factory fresh' : spec.age < 0.65 ? 'Field-seasoned' : 'Heavy salvage'}</output>
          <input type="range" min={0} max={1} step={0.01} value={spec.age} data-testid="bench-material-age"
            onChange={(e) => keep({ ...spec, age: Number(e.currentTarget.value) })} />
        </label>
      </div>

      <p className="bench-parts-cost">
        <b>{spec.name}</b><span className="bench-parts-cost-sep">. </span>A material takes a blank and the bench's time, like a written ground material.
      </p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(print)} data-testid="bench-print-material">{printLabel}</button>
        {onSave ? <button onClick={() => onSave(print)} data-testid="bench-save-material">Save as preset</button> : null}
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </div>
  );
};
